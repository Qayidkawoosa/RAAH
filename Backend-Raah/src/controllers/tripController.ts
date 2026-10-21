import { Request, Response } from 'express';
import { prisma } from '../config/db';

export interface TripRecord {
  id: string;
  busNo: string;
  driverId: string;
  driverName: string;
  routeName: string;
  status: 'idle' | 'active' | 'completed' | 'sos';
  startedAt: number;
  endedAt?: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  safetyScore: number;
  schoolId?: string;
  createdAt: Date;
}

export interface BusFleetItem {
  busNo: string;
  plateNumber: string;
  capacity: number;
  schoolId: string;
  schoolName: string;
  status: 'idle' | 'active' | 'sos';
  activeTripId?: string;
  currentRoute?: string;
  driverName?: string;
}

// In-memory Trip Store
export const tripDatabase: Map<string, TripRecord> = new Map();

// In-memory Fleet Bus Registry — dynamically populated from real registered drivers/buses
export const fleetBuses: Map<string, BusFleetItem> = new Map();

/**
 * POST /api/trips/start
 * Starts a new trip for an authorized driver
 * Protected: Drivers or Admins
 */
export async function startTrip(req: Request, res: Response): Promise<void> {
  try {
    const driverId = req.user?.userId;
    const driverName = req.user?.email ? req.user.email.split('@')[0] : 'Assigned Driver';
    const { busNo, routeName, startLat, startLng, schoolId } = req.body;

    if (!busNo || !routeName) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'busNo and routeName are required fields to start a trip',
      });
      return;
    }

    const normalizedBusNo = busNo.trim().toUpperCase();

    // Check if the bus exists in the fleet or PostgreSQL database
    let bus = fleetBuses.get(normalizedBusNo);
    if (!bus) {
      const dbBus = await prisma.bus.findUnique({
        where: { busNo: normalizedBusNo },
        include: { school: true },
      });
      if (dbBus) {
        bus = {
          busNo: dbBus.busNo,
          plateNumber: dbBus.busNo,
          capacity: dbBus.capacity,
          schoolId: dbBus.schoolId,
          schoolName: dbBus.school?.name || 'Kashmir Valley School',
          status: 'idle',
          driverName,
        };
        fleetBuses.set(normalizedBusNo, bus);
      } else {
        // Dynamically register bus in database & memory so any registered driver can start immediately
        let defaultSchool = await prisma.school.findFirst();
        if (!defaultSchool) {
          defaultSchool = await prisma.school.create({
            data: {
              name: 'Kashmir Valley School',
              address: 'Srinagar, Kashmir',
            },
          });
        }
        await prisma.bus.create({
          data: {
            busNo: normalizedBusNo,
            capacity: 32,
            registrationStatus: 'Compliant',
            schoolId: defaultSchool.id,
          },
        }).catch(() => {});
        bus = {
          busNo: normalizedBusNo,
          plateNumber: normalizedBusNo,
          capacity: 32,
          schoolId: defaultSchool.id,
          schoolName: defaultSchool.name,
          status: 'idle',
          driverName,
        };
        fleetBuses.set(normalizedBusNo, bus);
      }
    }

    // Check if the bus is already in an active trip
    if (bus.status === 'active') {
      res.status(409).json({
        error: 'Conflict',
        message: `Bus '${normalizedBusNo}' is already on an active trip (Trip ID: ${bus.activeTripId})`,
      });
      return;
    }

    const newTripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTrip: TripRecord = {
      id: newTripId,
      busNo: normalizedBusNo,
      driverId: driverId || 'unknown_driver',
      driverName: (req.user as any)?.name || driverName,
      routeName: routeName.trim(),
      status: 'active',
      startedAt: Date.now(),
      distanceKm: 0,
      maxSpeedKmh: 0,
      avgSpeedKmh: 0,
      safetyScore: 100, // Starts with a clean 100 score
      schoolId: schoolId || bus.schoolId,
      createdAt: new Date(),
    };

    tripDatabase.set(newTripId, newTrip);

    // Update fleet state
    bus.status = 'active';
    bus.activeTripId = newTripId;
    bus.currentRoute = newTrip.routeName;

    res.status(201).json({
      status: 'success',
      message: 'Trip started successfully',
      trip: newTrip,
    });
  } catch (error: any) {
    console.error('startTrip error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to start trip',
    });
  }
}

/**
 * POST /api/trips/end
 * Concludes an active trip
 * Protected: Drivers or Admins
 */
export async function endTrip(req: Request, res: Response): Promise<void> {
  try {
    const { tripId, distanceKm, avgSpeedKmh, maxSpeedKmh, safetyScore } = req.body;

    let targetTrip: TripRecord | undefined;

    if (tripId) {
      targetTrip = tripDatabase.get(tripId);
    } else {
      // Find active trip belonging to current driver
      for (const t of tripDatabase.values()) {
        if (t.driverId === req.user?.userId && t.status === 'active') {
          targetTrip = t;
          break;
        }
      }
    }

    if (!targetTrip) {
      res.status(404).json({
        error: 'NotFound',
        message: 'No active trip found to end',
      });
      return;
    }

    if (targetTrip.status === 'completed') {
      res.status(400).json({
        error: 'BadRequest',
        message: `Trip '${targetTrip.id}' is already marked as completed`,
      });
      return;
    }

    // Conclude trip
    targetTrip.status = 'completed';
    targetTrip.endedAt = Date.now();
    if (typeof distanceKm === 'number') targetTrip.distanceKm = distanceKm;
    if (typeof avgSpeedKmh === 'number') targetTrip.avgSpeedKmh = avgSpeedKmh;
    if (typeof maxSpeedKmh === 'number') targetTrip.maxSpeedKmh = maxSpeedKmh;
    if (typeof safetyScore === 'number') targetTrip.safetyScore = safetyScore;

    // Reset bus fleet status
    const bus = fleetBuses.get(targetTrip.busNo);
    if (bus && bus.activeTripId === targetTrip.id) {
      bus.status = 'idle';
      bus.activeTripId = undefined;
    }

    const durationSeconds = Math.round((targetTrip.endedAt - targetTrip.startedAt) / 1000);

    res.status(200).json({
      status: 'success',
      message: 'Trip completed successfully',
      summary: {
        tripId: targetTrip.id,
        busNo: targetTrip.busNo,
        durationSeconds,
        distanceKm: targetTrip.distanceKm,
        safetyScore: targetTrip.safetyScore,
        startedAt: targetTrip.startedAt,
        endedAt: targetTrip.endedAt,
      },
      trip: targetTrip,
    });
  } catch (error: any) {
    console.error('endTrip error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to end trip',
    });
  }
}

/**
 * GET /api/fleet/buses
 * Retrieves all registered buses in the fleet with their live operational status
 * Protected: Authenticated users (School managers, drivers, parents, RTO)
 */
export async function getFleetBuses(_req: Request, res: Response): Promise<void> {
  try {
    const dbBuses = await prisma.bus.findMany({
      include: { school: true, driver: true },
    });

    const buses = dbBuses.map((b) => ({
      busNo: b.busNo,
      plateNumber: b.busNo,
      capacity: b.capacity,
      schoolId: b.schoolId,
      schoolName: b.school?.name || 'Kashmir Valley School',
      status: fleetBuses.get(b.busNo)?.status || 'idle',
      driverName: b.driver?.[0]?.name || fleetBuses.get(b.busNo)?.driverName || 'Driver',
      studentsOnBoard: 0,
      safetyScore: 100,
    }));

    for (const [busNo, item] of fleetBuses.entries()) {
      if (!buses.some((b) => b.busNo === busNo)) {
        buses.push({
          busNo: item.busNo,
          plateNumber: item.plateNumber,
          capacity: item.capacity,
          schoolId: item.schoolId,
          schoolName: item.schoolName,
          status: item.status,
          driverName: item.driverName || 'Driver',
          studentsOnBoard: 0,
          safetyScore: 100,
        });
      }
    }

    res.status(200).json({
      status: 'success',
      count: buses.length,
      buses,
    });
  } catch (error: any) {
    console.error('getFleetBuses error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch fleet buses',
    });
  }
}
