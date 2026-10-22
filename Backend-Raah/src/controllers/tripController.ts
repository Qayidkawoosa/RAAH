import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { hashPassword } from '../utils/password';

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
      include: { school: true, driver: true, route: true },
    });

    const buses = dbBuses.map((b) => ({
      busNo: b.busNo,
      plateNumber: b.busNo,
      capacity: b.capacity,
      schoolId: b.schoolId,
      schoolName: b.school?.name || 'Kashmir Valley School',
      status: fleetBuses.get(b.busNo)?.status || 'idle',
      driverName: b.driver?.[0]?.name || fleetBuses.get(b.busNo)?.driverName || 'Driver',
      routeName: b.route?.name || fleetBuses.get(b.busNo)?.currentRoute || 'Assigned Route',
      routeId: b.routeId,
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
          routeName: item.currentRoute || 'Assigned Route',
          routeId: null,
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

/**
 * POST /api/fleet/enroll-driver
 * Admin-controlled driver enrollment & planned route binding
 * Body: { driverName, phone, busNo, routeId, password, schoolId }
 */
export async function enrollDriver(req: Request, res: Response): Promise<void> {
  try {
    const { driverName, phone, busNo, routeId, password, schoolId } = req.body;

    if (!driverName || !busNo || !password) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'driverName, busNo, and password are required fields',
      });
      return;
    }

    const normalizedBusNo = String(busNo).trim().toUpperCase();
    const cleanDriverName = String(driverName).trim();
    const rawPassword = String(password).trim();
    const phoneClean = phone ? String(phone).trim() : null;

    // 1. Generate driver email: driverName.toLowerCase().replace(/\s+/g, '') + '@kashmirschool.edu' (or unique)
    const baseEmailPrefix = cleanDriverName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') || 'driver';
    let email = `${baseEmailPrefix}@kashmirschool.edu`;
    let count = 1;
    while (await prisma.user.findUnique({ where: { email } })) {
      email = `${baseEmailPrefix}${count}@kashmirschool.edu`;
      count++;
    }

    // 2. Hash password using hashPassword(password)
    const passwordHash = await hashPassword(rawPassword);

    // 3. Ensure School exists
    let targetSchoolId = schoolId ? String(schoolId).trim() : null;
    if (!targetSchoolId) {
      const defaultSchool = await prisma.school.findFirst();
      if (defaultSchool) {
        targetSchoolId = defaultSchool.id;
      } else {
        const createdSchool = await prisma.school.create({
          data: {
            name: 'Kashmir Valley School',
            address: 'Hazratbal, Srinagar, Kashmir',
          },
        });
        targetSchoolId = createdSchool.id;
      }
    }

    // 4. Validate or resolve routeId if provided
    let validRouteId: string | null = null;
    if (routeId) {
      const foundRoute = await prisma.route.findFirst({
        where: {
          OR: [{ id: String(routeId) }, { name: String(routeId) }],
        },
      });
      if (foundRoute) {
        validRouteId = foundRoute.id;
      }
    }

    // 5. In a PostgreSQL transaction via Prisma:
    //    1. Upsert Bus with busNo, schoolId, routeId
    //    2. Create User with name: driverName, email, passwordHash, role: 'DRIVER', phone, assignedBusNo: busNo, schoolId
    const result = await prisma.$transaction(async (tx) => {
      // Upsert Bus
      const bus = await tx.bus.upsert({
        where: { busNo: normalizedBusNo },
        update: {
          schoolId: targetSchoolId!,
          ...(validRouteId ? { routeId: validRouteId } : {}),
        },
        create: {
          busNo: normalizedBusNo,
          capacity: 32,
          registrationStatus: 'Compliant',
          schoolId: targetSchoolId!,
          routeId: validRouteId || null,
        },
        include: { route: true },
      });

      // Clear any prior driver assignment to this bus so vehicle assignment is distinct
      await tx.user.updateMany({
        where: { assignedBusNo: normalizedBusNo, role: 'DRIVER' },
        data: { assignedBusNo: null },
      });

      // Create Driver User
      const user = await tx.user.create({
        data: {
          name: cleanDriverName,
          email,
          passwordHash,
          role: 'DRIVER',
          phone: phoneClean,
          assignedBusNo: normalizedBusNo,
          schoolId: targetSchoolId,
        },
      });

      return { bus, user };
    });

    // 6. Update in-memory registry so live dispatch reflects immediately
    fleetBuses.set(normalizedBusNo, {
      busNo: normalizedBusNo,
      plateNumber: normalizedBusNo,
      capacity: result.bus.capacity,
      schoolId: targetSchoolId!,
      schoolName: 'Kashmir Valley School',
      status: 'idle',
      driverName: cleanDriverName,
      currentRoute: result.bus.route?.name,
    });

    // 7. Return response matching requirement: { status: 'success', driverEmail: email, busNo, routeId }
    res.status(201).json({
      status: 'success',
      driverEmail: email,
      busNo: normalizedBusNo,
      routeId: validRouteId || routeId || null,
      driverName: cleanDriverName,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        phone: result.user.phone,
        role: 'driver',
        assignedBusNo: normalizedBusNo,
      },
    });
  } catch (error: any) {
    console.error('enrollDriver error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to enroll driver and bus',
      details: error.message,
    });
  }
}

/**
 * DELETE /api/fleet/:busNo
 * Deletes driver user and bus from PostgreSQL database and removes from live fleet
 */
export async function deleteFleetBus(req: Request, res: Response): Promise<void> {
  try {
    const rawBusNo = req.params.busNo || req.body?.busNo;
    if (!rawBusNo) {
      res.status(400).json({ error: 'BadRequest', message: 'busNo is required' });
      return;
    }
    const busNo = String(rawBusNo).trim().toUpperCase();

    // 1. In a PostgreSQL transaction, delete driver user and bus
    await prisma.$transaction(async (tx) => {
      // Find the bus
      const existingBus = await tx.bus.findFirst({
        where: { busNo: { equals: busNo, mode: 'insensitive' } },
        include: { driver: true, trips: true },
      });

      if (existingBus) {
        // Delete DMS incidents linked to this bus's trips
        const tripIds = existingBus.trips.map((t) => t.id);
        if (tripIds.length > 0) {
          await tx.dmsIncident.deleteMany({
            where: { tripId: { in: tripIds } },
          });
          await tx.trip.deleteMany({
            where: { id: { in: tripIds } },
          });
        }

        // Unlink students assigned to this bus
        await tx.student.updateMany({
          where: { busId: existingBus.id },
          data: { busId: null },
        });

        // Delete driver user(s) assigned to this bus
        await tx.user.deleteMany({
          where: {
            OR: [
              { assignedBusNo: { equals: busNo, mode: 'insensitive' } },
              { id: { in: existingBus.driver.map((d) => d.id) } },
            ],
            role: 'DRIVER',
          },
        });

        // Delete the bus itself
        await tx.bus.delete({
          where: { id: existingBus.id },
        });
      } else {
        // Even if bus not found in bus table, delete any driver assigned to this bus number
        await tx.user.deleteMany({
          where: {
            assignedBusNo: { equals: busNo, mode: 'insensitive' },
            role: 'DRIVER',
          },
        });
      }
    });

    // 2. Remove from live fleet registry
    fleetBuses.delete(busNo);

    console.log(`🗑️ [Fleet Delete] Deleted Bus ${busNo} and driver from PostgreSQL.`);

    res.status(200).json({
      status: 'success',
      message: `Bus ${busNo} and driver deleted successfully from database.`,
      busNo,
    });
  } catch (error: any) {
    console.error('deleteFleetBus error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to delete driver and bus from database',
      details: error.message,
    });
  }
}


/**
 * GET /api/fleet/routes
 * Returns all school routes with their waypoint stops.
 * Seeds standard Srinagar school routes if DB has no routes yet.
 */
export async function getFleetRoutes(_req: Request, res: Response): Promise<void> {
  try {
    let routes = await prisma.route.findMany({
      include: {
        stops: { orderBy: { stopOrder: 'asc' } },
        _count: { select: { buses: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (routes.length === 0) {
      let school = await prisma.school.findFirst();
      if (!school) {
        school = await prisma.school.create({
          data: {
            name: 'Kashmir Valley School',
            address: 'Hazratbal, Srinagar, Kashmir',
          },
        });
      }

      const seedRoutesData = [
        {
          name: 'Lal Chowk → Kashmir Valley School',
          description: 'Main City Center to Hazratbal Campus via Khanyar and Hawal',
          stops: [
            { name: 'Lal Chowk', latitude: 34.0725, longitude: 74.8105, stopOrder: 1 },
            { name: 'Khanyar', latitude: 34.0890, longitude: 74.8210, stopOrder: 2 },
            { name: 'Hawal', latitude: 34.0980, longitude: 74.8230, stopOrder: 3 },
            { name: 'Naseem Bagh', latitude: 34.1200, longitude: 74.8360, stopOrder: 4 },
            { name: 'Kashmir Valley School', latitude: 34.13011, longitude: 74.84315, stopOrder: 5 },
          ],
        },
        {
          name: 'Rajbagh → Kashmir Valley School',
          description: 'Boulevard Road corridor along Dal Lake via Nishat',
          stops: [
            { name: 'Rajbagh', latitude: 34.0561, longitude: 74.8210, stopOrder: 1 },
            { name: 'Dalgate', latitude: 34.0725, longitude: 74.8210, stopOrder: 2 },
            { name: 'Nehru Park', latitude: 34.0880, longitude: 74.8420, stopOrder: 3 },
            { name: 'Nishat', latitude: 34.1120, longitude: 74.8480, stopOrder: 4 },
            { name: 'Kashmir Valley School', latitude: 34.13011, longitude: 74.84315, stopOrder: 5 },
          ],
        },
        {
          name: 'Bemina → Kashmir Valley School',
          description: 'West Srinagar bypass via Batamaloo and Nowhatta',
          stops: [
            { name: 'Bemina', latitude: 34.0740, longitude: 74.7730, stopOrder: 1 },
            { name: 'Batamaloo', latitude: 34.0715, longitude: 74.7930, stopOrder: 2 },
            { name: 'Lal Chowk', latitude: 34.0725, longitude: 74.8105, stopOrder: 3 },
            { name: 'Nowhatta', latitude: 34.0850, longitude: 74.8190, stopOrder: 4 },
            { name: 'Naseem Bagh', latitude: 34.1200, longitude: 74.8360, stopOrder: 5 },
            { name: 'Kashmir Valley School', latitude: 34.13011, longitude: 74.84315, stopOrder: 6 },
          ],
        },
        {
          name: 'Soura → Kashmir Valley School',
          description: 'North Srinagar loop via Buchpora and Illahi Bagh',
          stops: [
            { name: 'Soura', latitude: 34.1350, longitude: 74.8030, stopOrder: 1 },
            { name: 'Buchpora', latitude: 34.1360, longitude: 74.8150, stopOrder: 2 },
            { name: 'Illahi Bagh', latitude: 34.1310, longitude: 74.8250, stopOrder: 3 },
            { name: 'Kashmir Valley School', latitude: 34.13011, longitude: 74.84315, stopOrder: 4 },
          ],
        },
        {
          name: 'HMT → Kashmir Valley School',
          description: 'Highway link via Parimpora, Qamarwari and Eidgah',
          stops: [
            { name: 'HMT', latitude: 34.1030, longitude: 74.7390, stopOrder: 1 },
            { name: 'Parimpora', latitude: 34.0880, longitude: 74.7610, stopOrder: 2 },
            { name: 'Qamarwari', latitude: 34.0950, longitude: 74.7750, stopOrder: 3 },
            { name: 'Eidgah', latitude: 34.0990, longitude: 74.8010, stopOrder: 4 },
            { name: 'Naseem Bagh', latitude: 34.1200, longitude: 74.8360, stopOrder: 5 },
            { name: 'Kashmir Valley School', latitude: 34.13011, longitude: 74.84315, stopOrder: 6 },
          ],
        },
      ];

      for (const r of seedRoutesData) {
        await prisma.route.create({
          data: {
            name: r.name,
            description: r.description,
            schoolId: school.id,
            stops: {
              create: r.stops,
            },
          },
        });
      }

      routes = await prisma.route.findMany({
        include: {
          stops: { orderBy: { stopOrder: 'asc' } },
          _count: { select: { buses: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    res.status(200).json({
      status: 'success',
      count: routes.length,
      routes,
    });
  } catch (error: any) {
    console.error('getFleetRoutes error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch routes' });
  }
}

/**
 * GET /api/fleet/driver-route
 * Fetch driver assigned route path and stops from bus record in PostgreSQL
 * Query params or param: busNo
 */
export async function getDriverRoute(req: Request, res: Response): Promise<void> {
  try {
    const busNo = (req.params.busNo || req.query.busNo || (req as any).user?.assignedBusNo || (req as any).user?.vehicleNo) as string;
    if (!busNo) {
      res.status(400).json({ error: 'BadRequest', message: 'busNo parameter is required' });
      return;
    }

    const normalizedBusNo = busNo.trim().toUpperCase();
    const bus = await prisma.bus.findUnique({
      where: { busNo: normalizedBusNo },
      include: {
        route: {
          include: {
            stops: { orderBy: { stopOrder: 'asc' } },
          },
        },
      },
    });

    if (!bus) {
      res.status(404).json({ error: 'NotFound', message: `Bus '${normalizedBusNo}' not found in database` });
      return;
    }

    let path: { latitude: number; longitude: number }[] = [];
    if (bus.route?.stops && bus.route.stops.length > 0) {
      path = bus.route.stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
    }

    res.status(200).json({
      status: 'success',
      busNo: bus.busNo,
      routeId: bus.routeId,
      routeName: bus.route?.name || 'Assigned Route',
      route: bus.route,
      path,
    });
  } catch (error: any) {
    console.error('getDriverRoute error:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch driver route' });
  }
}

