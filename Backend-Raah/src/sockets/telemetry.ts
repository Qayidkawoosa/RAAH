import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db';
import { DmsViolationType, IncidentSeverity } from '@prisma/client';

export interface LocationPayload {
  busNo: string;
  tripId?: string | null;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  speed?: number;
  speed_kmph?: number;
  speedKmh?: number;
  heading?: number;
  timestamp?: number;
  updatedAt?: number;
  driverName?: string;
  status?: string;
  etaMinutes?: number;
  nextStop?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface DmsAlertPayload {
  id?: string;
  busNo: string;
  tripId?: string | null;
  driverId?: string;
  type: string;
  message?: string;
  severity?: string;
  confidence?: number;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  speed_kmph?: number;
  speedKmh?: number;
  speed?: number;
  snapshotUrl?: string;
  timestamp?: number | string;
}

export function extractBusNo(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && parsed.busNo) {
          return String(parsed.busNo).toUpperCase().trim();
        }
      } catch {
        // Fall through to plain string
      }
    }
    return trimmed.toUpperCase();
  }
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    if (obj.busNo) {
      return String(obj.busNo).toUpperCase().trim();
    }
  }
  return null;
}

export function mapViolationType(type: string): DmsViolationType {
  const normalized = (type || '').toLowerCase().trim();
  switch (normalized) {
    case 'drowsiness':
    case 'drowsy':
    case 'microsleep':
    case 'eyes_closed':
      return DmsViolationType.DROWSINESS;
    case 'phone_use':
    case 'phone_distraction':
    case 'phone':
    case 'calling':
    case 'texting':
      return DmsViolationType.PHONE_DISTRACTION;
    case 'seatbelt_off':
    case 'no_seatbelt':
    case 'seatbelt':
      return DmsViolationType.NO_SEATBELT;
    case 'distraction':
    case 'head_pose':
    case 'looking_away':
      return DmsViolationType.HEAD_POSE;
    case 'yawn':
    case 'fatigue_yawn':
    case 'fatigue':
      return DmsViolationType.FATIGUE_YAWN;
    default:
      return DmsViolationType.HEAD_POSE;
  }
}

export function mapSeverity(severity?: string): IncidentSeverity {
  const normalized = (severity || '').toLowerCase().trim();
  switch (normalized) {
    case 'critical':
    case 'sos':
      return IncidentSeverity.CRITICAL;
    case 'warn':
    case 'warning':
    case 'high':
      return IncidentSeverity.HIGH;
    case 'medium':
      return IncidentSeverity.MEDIUM;
    case 'info':
    case 'low':
    default:
      return IncidentSeverity.LOW;
  }
}

export function setupTelemetrySockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket Connected] ID: ${socket.id}`);

    // 1. Join Bus Room — Dual support for `join:bus` AND `bus:watch`
    const handleJoinBus = (payload: unknown) => {
      const busNo = extractBusNo(payload);
      if (!busNo) return;
      const room = `bus_${busNo}`;
      socket.join(room);
      console.log(`👥 [Room Join] Socket ${socket.id} joined room "${room}"`);
      socket.emit('joined:bus', { room, busNo, status: 'listening' });
    };

    socket.on('join:bus', handleJoinBus);
    socket.on('bus:watch', handleJoinBus);

    // 2. Leave Bus Room — Dual support for `leave:bus` AND `bus:unwatch`
    const handleLeaveBus = (payload: unknown) => {
      const busNo = extractBusNo(payload);
      if (!busNo) return;
      const room = `bus_${busNo}`;
      socket.leave(room);
      console.log(`👋 [Room Leave] Socket ${socket.id} left room "${room}"`);
    };

    socket.on('leave:bus', handleLeaveBus);
    socket.on('bus:unwatch', handleLeaveBus);

    // 3. 1 Hz GPS Telemetry Updates — Dual support for `telemetry:location` AND `driver:state`
    const handleLocationUpdate = (raw: unknown) => {
      let data: LocationPayload;
      if (typeof raw === 'string') {
        try {
          data = JSON.parse(raw);
        } catch {
          return;
        }
      } else if (typeof raw === 'object' && raw !== null) {
        data = raw as LocationPayload;
      } else {
        return;
      }

      if (!data || !data.busNo) return;

      const busNo = String(data.busNo).toUpperCase().trim();
      const latitude = data.latitude ?? data.lat ?? data.location?.latitude;
      const longitude = data.longitude ?? data.lng ?? data.location?.longitude;

      if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const room = `bus_${busNo}`;
      const speed = data.speedKmh ?? data.speed ?? data.speed_kmph ?? 0;
      const heading = data.heading ?? 0;
      const timestamp = data.updatedAt ?? data.timestamp ?? Date.now();
      const tripId = data.tripId ? String(data.tripId) : null;
      const driverName = data.driverName || 'Driver';
      const status = data.status || 'active';
      const etaMinutes = data.etaMinutes ?? 0;
      const nextStop = data.nextStop || '';

      console.log(`📍 [GPS Broadcast] Bus ${busNo} at (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) | Speed: ${speed} km/h`);

      // Broadcast backend telemetry event format
      socket.to(room).emit('telemetry:location:update', {
        busNo,
        tripId,
        latitude,
        longitude,
        speed,
        heading,
        timestamp,
      });

      // Broadcast frontend BusLiveState event format
      socket.to(room).emit('bus:state', {
        busNo,
        tripId,
        driverName,
        status,
        location: {
          latitude,
          longitude,
        },
        heading,
        speedKmh: speed,
        etaMinutes,
        nextStop,
        updatedAt: timestamp,
      });
    };

    socket.on('telemetry:location', handleLocationUpdate);
    socket.on('driver:state', handleLocationUpdate);

    // 4. Driver Safety Alarms — Dual support for `dms:alert` AND `driver:event`
    const handleDmsAlert = async (raw: unknown) => {
      let alert: DmsAlertPayload;
      if (typeof raw === 'string') {
        try {
          alert = JSON.parse(raw);
        } catch {
          return;
        }
      } else if (typeof raw === 'object' && raw !== null) {
        alert = raw as DmsAlertPayload;
      } else {
        return;
      }

      if (!alert || !alert.busNo || !alert.type) return;

      const busNo = String(alert.busNo).toUpperCase().trim();
      const room = `bus_${busNo}`;
      const violationType = mapViolationType(alert.type);
      const severity = mapSeverity(alert.severity);

      const latitude = alert.latitude ?? alert.lat ?? alert.location?.latitude;
      const longitude = alert.longitude ?? alert.lng ?? alert.location?.longitude;
      const speedKmh = alert.speedKmh ?? alert.speed_kmph ?? alert.speed;
      const confidence = alert.confidence || 0.95;
      const timestamp = typeof alert.timestamp === 'number'
        ? alert.timestamp
        : (alert.timestamp ? new Date(alert.timestamp).getTime() : Date.now());

      console.log(`🚨 [DMS ALARM] ${violationType} (${severity}) on Bus ${busNo}!`);

      // Broadcast backend DMS alert event
      io.to(room).emit('dms:alert:broadcast', {
        busNo,
        tripId: alert.tripId,
        driverId: alert.driverId,
        violationType,
        severity,
        confidence,
        latitude,
        longitude,
        speedKmh,
        snapshotUrl: alert.snapshotUrl,
        timestamp,
      });

      // Broadcast frontend trip event
      io.to(room).emit('bus:event', {
        id: alert.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        busNo,
        type: alert.type,
        message: alert.message || `DMS Alert: ${violationType} (${severity})`,
        timestamp,
        location: (typeof latitude === 'number' && typeof longitude === 'number')
          ? { latitude, longitude }
          : undefined,
        speedKmh: typeof speedKmh === 'number' ? speedKmh : undefined,
        severity,
        violationType,
        confidence,
      });

      // Full Prisma PostgreSQL Persistence
      try {
        let resolvedTripId = alert.tripId;
        if (!resolvedTripId) {
          const activeTrip = await prisma.trip.findFirst({
            where: {
              bus: { busNo: { equals: busNo, mode: 'insensitive' } },
              status: 'ACTIVE',
            },
            orderBy: { startedAt: 'desc' },
          });
          if (activeTrip) {
            resolvedTripId = activeTrip.id;
          }
        }

        if (resolvedTripId) {
          await prisma.dmsIncident.create({
            data: {
              tripId: resolvedTripId,
              violationType,
              severity,
              confidence,
              latitude: typeof latitude === 'number' ? latitude : null,
              longitude: typeof longitude === 'number' ? longitude : null,
              speedKmh: typeof speedKmh === 'number' ? speedKmh : null,
              snapshotUrl: alert.snapshotUrl || null,
              timestamp: new Date(timestamp),
            },
          });
          console.log(`💾 [DB Saved] DMS incident logged to PostgreSQL (${violationType}) for Trip ${resolvedTripId}.`);
        } else {
          console.warn(`⚠️ [DB Skip] No active trip found for Bus ${busNo}, incident not persisted to DB.`);
        }
      } catch (err) {
        console.error('Failed to log DMS incident to DB:', err);
      }
    };

    socket.on('dms:alert', handleDmsAlert);
    socket.on('driver:event', handleDmsAlert);

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket Disconnected] ID: ${socket.id}`);
    });
  });

  return io;
}
