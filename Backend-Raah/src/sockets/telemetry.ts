import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db';
import { DmsViolationType, IncidentSeverity } from '@prisma/client';

export interface LocationPayload {
  busNo: string;
  tripId?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  speed?: number;
  speed_kmph?: number;
  heading?: number;
  timestamp?: number;
}

export interface DmsAlertPayload {
  busNo: string;
  tripId?: string;
  driverId?: string;
  type: string;
  severity?: string;
  confidence?: number;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  speed_kmph?: number;
  speedKmh?: number;
  snapshotUrl?: string;
  timestamp?: number | string;
}

function mapViolationType(type: string): DmsViolationType {
  const normalized = (type || '').toLowerCase().trim();
  switch (normalized) {
    case 'drowsiness':
    case 'drowsy':
      return DmsViolationType.DROWSINESS;
    case 'phone_use':
    case 'phone_distraction':
    case 'phone':
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
      return DmsViolationType.FATIGUE_YAWN;
    default:
      return DmsViolationType.HEAD_POSE;
  }
}

function mapSeverity(severity?: string): IncidentSeverity {
  const normalized = (severity || '').toLowerCase().trim();
  switch (normalized) {
    case 'critical':
      return IncidentSeverity.CRITICAL;
    case 'warn':
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

    socket.on('join:bus', (busNo: string) => {
      if (!busNo) return;
      const room = `bus_${busNo.toUpperCase().trim()}`;
      socket.join(room);
      console.log(`👥 [Room Join] Socket ${socket.id} joined room "${room}"`);
      socket.emit('joined:bus', { room, status: 'listening' });
    });

    socket.on('leave:bus', (busNo: string) => {
      if (!busNo) return;
      const room = `bus_${busNo.toUpperCase().trim()}`;
      socket.leave(room);
      console.log(`👋 [Room Leave] Socket ${socket.id} left room "${room}"`);
    });

    // 3. Driver Emits 1 Hz GPS Telemetry
    socket.on('telemetry:location', (raw: any) => {
      const data: LocationPayload = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || !data.busNo) return;
      const latitude = data.latitude ?? data.lat;
      const longitude = data.longitude ?? data.lng;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
      const room = `bus_${data.busNo.toUpperCase().trim()}`;
      const speed = data.speed ?? data.speed_kmph ?? 0;
      // 📢 Print live GPS to terminal!
      console.log(`📍 [GPS Broadcast] Bus ${data.busNo} at (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) | Speed: ${speed} km/h`);
      socket.to(room).emit('telemetry:location:update', {
        busNo: data.busNo,
        tripId: data.tripId,
        latitude,
        longitude,
        speed,
        heading: data.heading ?? 0,
        timestamp: data.timestamp ?? Date.now(),
      });
    });

    socket.on('dms:alert', async (alert: DmsAlertPayload) => {
      if (!alert || !alert.busNo || !alert.type) return;

      const room = `bus_${alert.busNo.toUpperCase().trim()}`;
      const violationType = mapViolationType(alert.type);
      const severity = mapSeverity(alert.severity);

      console.log(`🚨 [DMS ALARM] ${violationType} (${severity}) on Bus ${alert.busNo}!`);

      io.to(room).emit('dms:alert:broadcast', {
        busNo: alert.busNo,
        tripId: alert.tripId,
        driverId: alert.driverId,
        violationType,
        severity,
        confidence: alert.confidence || 0.95,
        latitude: alert.latitude ?? alert.lat,
        longitude: alert.longitude ?? alert.lng,
        timestamp: alert.timestamp || Date.now(),
      });

      try {
        if (alert.tripId) {
          await prisma.dmsIncident.create({
            data: {
              tripId: alert.tripId,
              violationType,
              severity,
              confidence: alert.confidence || 0.95,
              latitude: alert.latitude ?? alert.lat,
              longitude: alert.longitude ?? alert.lng,
              speedKmh: alert.speedKmh ?? alert.speed_kmph,
              snapshotUrl: alert.snapshotUrl,
              timestamp: new Date(alert.timestamp || Date.now()),
            },
          });
          console.log(`💾 [DB Saved] DMS incident logged to PostgreSQL (${violationType}).`);
        }
      } catch (err) {
        console.error('Failed to log DMS incident to DB:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket Disconnected] ID: ${socket.id}`);
    });
  });

  return io;
}
