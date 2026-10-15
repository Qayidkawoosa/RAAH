import { Request, Response } from 'express';

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

// In-memory Trip Store (Ready to be backed by Prisma when Person 1 migrations land)
export const tripDatabase: Map<string, TripRecord> = new Map();

// In-memory Fleet Bus Registry (Valley School Fleet)
export const fleetBuses: Map<string, BusFleetItem> = new Map([
  [
    'BUS-04',
    {
      busNo: 'BUS-04',
      plateNumber: 'JK-01-AB-4004',
      capacity: 34,
      schoolId: 'sch_dps_srinagar',
      schoolName: 'Delhi Public School Srinagar',
      status: 'idle',
      currentRoute: 'Lal Chowk to Athwajan via Pantha Chowk',
      driverName: 'Bashir Ahmad',
    },
  ],
  [
    'BUS-07',
    {
      busNo: 'BUS-07',
      plateNumber: 'JK-01-CD-7007',
      capacity: 40,
      schoolId: 'sch_burnhall_srinagar',
      schoolName: 'Burn Hall School Srinagar',
      status: 'idle',
      currentRoute: 'Hazratbal to Sonwar via Boulevard Road',
      driverName: 'Ghulam Rasool',
    },
  ],
  [
    'BUS-12',
    {
      busNo: 'BUS-12',
      plateNumber: 'JK-02-EF-1212',
      capacity: 30,
      schoolId: 'sch_mallinson_srinagar',
      schoolName: 'Mallinson Girls School',
      status: 'idle',
      currentRoute: 'Rajbagh to Zakura via Nawa Kadal',
      driverName: 'Manzoor Mir',
    },
  ],
]);

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

    // Check if the bus exists in the fleet
    const bus = fleetBuses.get(normalizedBusNo);
    if (!bus) {
      res.status(404).json({
        error: 'NotFound',
        message: `Bus '${busNo}' is not registered in the school fleet`,
      });
      return;
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
    const list = Array.from(fleetBuses.values());
    res.status(200).json({
      status: 'success',
      count: list.length,
      buses: list,
    });
  } catch (error: any) {
    console.error('getFleetBuses error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch fleet buses',
    });
  }
}
