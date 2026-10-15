import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LatLng, Trip, TripEvent, TripPoint } from '../types/trip';
import { UserProfile } from '../types/auth';
import { Student } from '../types/fleet';
import {
  DEMO_ROUTE_PATH_A,
  DEMO_BUS_NO,
  ALL_ROUTES,
  RouteConfig,
} from '../constants/demoRoute';
import { TripMonitor, computeSafetyScore } from '../utils/tripMonitor';
import {
  bearingDegrees,
  distanceMeters,
  distanceToPathMeters,
  remainingPathMeters,
} from '../utils/geo';
import { createId } from '../utils/id';
import { locationService } from '../services/locationService';
import { startDriveSimulation } from '../services/demo/driveSimulator';
import { realtimeService } from '../services/realtime';
import { tripService } from '../services/tripService';
import { isLiveBackend } from '../config/env';
import { ETA_FALLBACK_SPEED_KMH } from '../constants/safety';
import { activeSchedule } from '../constants/schedule';
import { backgroundDmsService } from '../services/dms/backgroundDmsService';
import { dmsEngine } from '../services/dms/dmsEngine';

export interface UpcomingPickup {
  stopName: string;
  studentNames: string[];
  parentNotified: boolean;
}

interface TripContextType {
  trip: Trip | null;
  lastPoint: TripPoint | null;
  liveScore: number;
  isSimulatedGps: boolean;
  upcomingPickup: UpcomingPickup | null;
  simulationRoutePath: LatLng[];
  busStudents: Student[];
  startTrip: (profile: UserProfile, routePath?: LatLng[]) => Promise<void>;
  autoStartIfDue: (profile: UserProfile, routePath: LatLng[]) => Promise<boolean>;
  endTrip: (reason?: string) => Promise<Trip | null>;
  triggerSos: () => void;
  notifyParentOfPickup: (customMessage?: string) => void;
  setSimulationRoute: (routePath: LatLng[]) => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [lastPoint, setLastPoint] = useState<TripPoint | null>(null);
  const [liveScore, setLiveScore] = useState(100);
  const [isSimulatedGps, setIsSimulatedGps] = useState(false);
  const [upcomingPickup, setUpcomingPickup] = useState<UpcomingPickup | null>(null);
  const [simulationRoutePath, setSimulationRoutePath] = useState<LatLng[]>(DEMO_ROUTE_PATH_A);
  const [busStudents, setBusStudents] = useState<Student[]>([]);
  const [, setNotifiedStops] = useState<string[]>([]);

  const tripRef = useRef<Trip | null>(null);
  const monitorRef = useRef<TripMonitor | null>(null);
  const offDemoRouteRef = useRef(false);
  const stopWatchingRef = useRef<(() => void) | null>(null);

  const upcomingPickupRef = useRef<UpcomingPickup | null>(null);
  const notifiedStopsRef = useRef<string[]>([]);
  const busStudentsRef = useRef<Student[]>([]);
  const activeRouteRef = useRef<RouteConfig>(ALL_ROUTES[0]);

  useEffect(() => () => stopWatchingRef.current?.(), []);

  const pushEvent = useCallback((event: TripEvent): void => {
    const current = tripRef.current;
    if (!current) return;
    const events = [...current.events, event];
    const updated: Trip = { ...current, events, safetyScore: computeSafetyScore(events) };
    tripRef.current = updated;
    setTrip(updated);
    setLiveScore(updated.safetyScore);
    realtimeService.publishEvent(updated.busNo, event);
  }, []);

  const endTrip = useCallback(async (reason?: string): Promise<Trip | null> => {
    stopWatchingRef.current?.();
    stopWatchingRef.current = null;

    // Immediately stop DMS camera and shut down active anomaly tracking
    try {
      await backgroundDmsService.stop();
    } catch (dmsErr) {
      console.warn('Failed to stop DMS service on trip end:', dmsErr);
    }
    dmsEngine.setTrackingActive(false);

    const current = tripRef.current;
    if (!current) return null;
    const endedAt = Date.now();
    const finished: Trip = {
      ...current,
      status: 'completed',
      endedAt,
      events: [
        ...current.events,
        {
          id: createId('evt'),
          type: 'trip_ended',
          message: reason ?? 'Trip ended',
          timestamp: endedAt,
        },
      ],
    };
    tripRef.current = null;
    setTrip(null);
    setLastPoint(null);
    upcomingPickupRef.current = null;
    setUpcomingPickup(null);
    try {
      await tripService.saveTrip(finished);
    } catch {
      // History persistence must never block ending a trip.
    }
    return finished;
  }, []);

  const handlePoint = useCallback(
    (point: TripPoint): void => {
      const current = tripRef.current;
      if (!current || current.status !== 'active') return;

      const pathPoints = activeRouteRef.current.path;
      const routeStops = activeRouteRef.current.stops;

      // 1. Auto-complete: reaching the school ends the trip on its own, so
      // the driver never has to remember to tap End Trip.
      const schoolLoc = pathPoints[pathPoints.length - 1];
      if (distanceMeters(point, schoolLoc) < 150) {
        endTrip('Arrived at school — trip completed automatically');
        return;
      }

      // Assign the planned route on the first fix. When the driver is
      // testing far from the Srinagar demo route, route-deviation checks
      // are disabled — comparing real GPS to a route the bus was never on
      // would flag nonsense deviations.
      if (!monitorRef.current) {
        offDemoRouteRef.current = distanceToPathMeters(point, pathPoints) > 2000;
        monitorRef.current = new TripMonitor(offDemoRouteRef.current ? [] : pathPoints);
      }

      const previous = current.path[current.path.length - 1];
      const addedKm = previous ? distanceMeters(previous, point) / 1000 : 0;
      const updated: Trip = {
        ...current,
        path: [...current.path, point],
        distanceKm: current.distanceKm + addedKm,
        maxSpeedKmh: Math.max(current.maxSpeedKmh, point.speedKmh),
      };
      const elapsedH = (point.timestamp - updated.startedAt) / 3_600_000;
      updated.avgSpeedKmh = elapsedH > 0 ? Math.min(updated.distanceKm / elapsedH, 80) : 0;
      tripRef.current = updated;
      setTrip(updated);
      setLastPoint(point);

      monitorRef.current?.addPoint(point).forEach(pushEvent);

      // 2. Check upcoming student pickups
      let foundUpcoming = false;
      const currentStudents = busStudentsRef.current;
      const currentNotified = notifiedStopsRef.current;

      for (const student of currentStudents) {
        if (!student.pickupStop) continue;
        const stop = routeStops.find((s) => s.name === student.pickupStop);
        if (!stop) continue;

        const dist = distanceMeters(point, stop.location);
        if (dist < 400 && !currentNotified.includes(stop.name)) {
          foundUpcoming = true;
          if (!upcomingPickupRef.current || upcomingPickupRef.current.stopName !== stop.name) {
            const boardingStudents = currentStudents
              .filter((s) => s.pickupStop === stop.name)
              .map((s) => s.name);
            const pickupData = {
              stopName: stop.name,
              studentNames: boardingStudents,
              parentNotified: false,
            };
            upcomingPickupRef.current = pickupData;
            setUpcomingPickup(pickupData);
          }
          break; // Show one upcoming stop at a time
        }
      }

      // If we move away from the stop (>450m) and haven't notified, clear the alert
      if (!foundUpcoming && upcomingPickupRef.current && !upcomingPickupRef.current.parentNotified) {
        upcomingPickupRef.current = null;
        setUpcomingPickup(null);
      }

      const remainingM = remainingPathMeters(point, pathPoints);
      const etaSpeed = Math.max(point.speedKmh, ETA_FALLBACK_SPEED_KMH);
      const offRoute = offDemoRouteRef.current;
      realtimeService.publishDriverState({
        busNo: updated.busNo,
        tripId: updated.id,
        driverName: updated.driverName,
        status: updated.status,
        location: { latitude: point.latitude, longitude: point.longitude },
        heading: previous ? bearingDegrees(previous, point) : 0,
        speedKmh: point.speedKmh,
        etaMinutes: offRoute
          ? 0
          : Math.max(1, Math.min(999, Math.round(remainingM / 1000 / (etaSpeed / 60)))),
        nextStop: offRoute
          ? 'En route'
          : routeStops.find((stop) => distanceMeters(point, stop.location) < remainingM)?.name ??
            routeStops[routeStops.length - 1].name,
        updatedAt: point.timestamp,
      });
    },
    [pushEvent, endTrip]
  );

  const startTrip = useCallback(
    async (profile: UserProfile, routePath: LatLng[] = simulationRoutePath): Promise<void> => {
      const startedAt = Date.now();

      // Look up selected route configuration by path coordinates or vehicle number
      const routeConfig = ALL_ROUTES.find((r) => r.path === routePath) ??
                          ALL_ROUTES.find((r) => r.busNo === profile.vehicleNo) ??
                          ALL_ROUTES[0];
      activeRouteRef.current = routeConfig;

      // Load students
      try {
        const students = await tripService.getStudents();
        const filtered = students.filter((s) => s.busNo === (profile.vehicleNo ?? DEMO_BUS_NO));
        busStudentsRef.current = filtered;
        setBusStudents(filtered);
      } catch (error) {
        console.error('Failed to load students for trip', error);
      }

      // Reset notified stops and upcoming pickup
      notifiedStopsRef.current = [];
      setNotifiedStops([]);
      upcomingPickupRef.current = null;
      setUpcomingPickup(null);

      const newTrip: Trip = {
        id: createId('trip'),
        busNo: profile.vehicleNo ?? 'JK-01-A-1234',
        driverId: profile.uid,
        driverName: profile.name,
        routeName: routeConfig.routeName,
        status: 'active',
        startedAt,
        distanceKm: 0,
        maxSpeedKmh: 0,
        avgSpeedKmh: 0,
        safetyScore: 100,
        events: [
          {
            id: createId('evt'),
            type: 'trip_started',
            message: `Trip started on route: ${routeConfig.routeName}`,
            timestamp: startedAt,
          },
        ],
        path: [],
      };
      tripRef.current = newTrip;
      monitorRef.current = null; // created on the first GPS fix
      offDemoRouteRef.current = false;
      setTrip(newTrip);
      setLiveScore(100);

      // Initialize DMS Engine for active trip
      if (profile.role === 'driver') {
        dmsEngine.tripId = newTrip.id;
        dmsEngine.busId = newTrip.busNo;
        dmsEngine.driverId = profile.uid;
        dmsEngine.setTrackingActive(true);
      }

      // On Web or Demo mode (no live backend), always run the drive simulation along the route
      // so the demo bus visibly drives along the Dal Lake route with speed and stop progress!
      const isWeb = typeof window !== 'undefined';
      if (!isLiveBackend || isWeb) {
        setIsSimulatedGps(true);
        stopWatchingRef.current = startDriveSimulation(handlePoint, routePath);
      } else {
        const hasPermission = await locationService.requestPermission();
        if (hasPermission) {
          setIsSimulatedGps(false);
          stopWatchingRef.current = await locationService.watchPosition(handlePoint);
        } else {
          setIsSimulatedGps(true);
          stopWatchingRef.current = startDriveSimulation(handlePoint, routePath);
        }
      }
    },
    [handlePoint, simulationRoutePath]
  );

  /**
   * Begin tracking only if a scheduled trip window is open and the bus is
   * not already parked at the school. Lives here, not in a screen, so every
   * entry point (tab mount, deep link, notification) obeys the same policy.
   */
  const autoStartIfDue = useCallback(
    async (profile: UserProfile, routePath: LatLng[]): Promise<boolean> => {
      if (tripRef.current || !activeSchedule()) return false;

      const school = routePath[routePath.length - 1];
      const hasPermission = await locationService.requestPermission();
      if (hasPermission) {
        const location = await locationService.getCurrentLocation();
        // Already at the school means the trip is over, not due to begin.
        if (location && distanceMeters(location, school) <= 150) return false;
      }

      await startTrip(profile, routePath);
      return true;
    },
    [startTrip]
  );

  const triggerSos = useCallback((): void => {
    const current = tripRef.current;
    if (!current) return;
    const point = current.path[current.path.length - 1];
    pushEvent({
      id: createId('evt'),
      type: 'sos',
      message: 'EMERGENCY SOS raised by driver',
      timestamp: Date.now(),
      location: point ? { latitude: point.latitude, longitude: point.longitude } : undefined,
    });
    const updated: Trip = { ...tripRef.current!, status: 'sos' };
    tripRef.current = updated;
    setTrip(updated);
  }, [pushEvent]);

  const notifyParentOfPickup = useCallback((customMessage?: string): void => {
    const currentPickup = upcomingPickupRef.current;
    if (!currentPickup || !tripRef.current) return;

    // 1. Mark as notified
    const updatedPickup = { ...currentPickup, parentNotified: true };
    upcomingPickupRef.current = updatedPickup;
    setUpcomingPickup(updatedPickup);

    // 2. Add to notified stops list
    const updatedNotified = [...notifiedStopsRef.current, currentPickup.stopName];
    notifiedStopsRef.current = updatedNotified;
    setNotifiedStops(updatedNotified);

    // 3. Emit a real-time event to parent / school alert feeds
    const names = currentPickup.studentNames.join(', ');
    const msg = customMessage || `Pickup confirmed: ${names} boarded at ${currentPickup.stopName}. Parent notified.`;
    pushEvent({
      id: createId('evt'),
      type: 'student_pickup',
      message: msg,
      timestamp: Date.now(),
      location: lastPoint ? { latitude: lastPoint.latitude, longitude: lastPoint.longitude } : undefined,
    });
  }, [pushEvent, lastPoint]);

  const setSimulationRoute = useCallback(
    (newRoute: LatLng[]) => {
      setSimulationRoutePath(newRoute);
      if (tripRef.current && tripRef.current.status === 'active' && isSimulatedGps) {
        stopWatchingRef.current?.();
        stopWatchingRef.current = startDriveSimulation(handlePoint, newRoute);
      }
    },
    [isSimulatedGps, handlePoint]
  );

  return (
    <TripContext.Provider
      value={{
        trip,
        lastPoint,
        liveScore,
        isSimulatedGps,
        upcomingPickup,
        simulationRoutePath,
        busStudents,
        startTrip,
        autoStartIfDue,
        endTrip,
        triggerSos,
        notifyParentOfPickup,
        setSimulationRoute,
      }}
    >
      {children}
    </TripContext.Provider>
  );
};

export const useTrip = (): TripContextType => {
  const context = useContext(TripContext);
  if (context === undefined) throw new Error('useTrip must be used within a TripProvider');
  return context;
};
