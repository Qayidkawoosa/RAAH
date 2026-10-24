import { Trip, TripEvent } from '../../types/trip';
import {
  AnalyticsSummary,
  Complaint,
  ComplianceRecord,
  DriverRanking,
  FleetBus,
  Student,
  ViolationRecord,
} from '../../types/fleet';
import {
  DEMO_BUS_NO,
  DEMO_DRIVER_NAME,
  DEMO_ROUTE_NAME,
  DEMO_ROUTE_PATH,
} from '../../constants/demoRoute';
import { computeSafetyScore } from '../../utils/tripMonitor';
import { createId } from '../../utils/id';

const DAY_MS = 86_400_000;

export const demoFleet: FleetBus[] = [];

export const demoRankings: DriverRanking[] = [];

export const demoComplaints: Complaint[] = [];

export const demoCompliance: ComplianceRecord[] = [];

export const demoStudents: Student[] = [];

export const demoViolations: ViolationRecord[] = [];

export const demoAnalytics: AnalyticsSummary = {
  totalTripsToday: 0,
  activeTrips: 0,
  totalViolationsWeek: 0,
  avgFleetSafetyScore: 100,
  complianceRate: 100,
  sosCountMonth: 0,
};

const historyEventSets: TripEvent[][] = [
  [],
  [
    { id: createId('evt'), type: 'overspeed', message: 'Overspeeding: 58 km/h on Boulevard Road', timestamp: Date.now() - DAY_MS, speedKmh: 58 },
  ],
  [],
  [
    { id: createId('evt'), type: 'long_stop', message: 'Unscheduled 4 minute stop at Dalgate', timestamp: Date.now() - 3 * DAY_MS },
    { id: createId('evt'), type: 'overspeed', message: 'Overspeeding: 55 km/h near Nishat', timestamp: Date.now() - 3 * DAY_MS, speedKmh: 55 },
  ],
  [],
];

export const buildDemoHistory = (driverId: string, driverName: string, busNo: string): Trip[] =>
  historyEventSets.map((events, index) => {
    const startedAt = Date.now() - (index + 1) * DAY_MS;
    const durationMs = 34 * 60_000 + index * 3 * 60_000;
    return {
      id: createId('trip'),
      busNo,
      driverId,
      driverName,
      routeName: DEMO_ROUTE_NAME,
      status: 'completed',
      startedAt,
      endedAt: startedAt + durationMs,
      distanceKm: 11.2,
      maxSpeedKmh: events.some((e) => e.type === 'overspeed') ? 58 : 46,
      avgSpeedKmh: 27 + index,
      safetyScore: computeSafetyScore(events),
      events,
      path: DEMO_ROUTE_PATH.map((p, i) => ({
        ...p,
        timestamp: startedAt + i * 150_000,
        speedKmh: 30,
      })),
    };
  });
