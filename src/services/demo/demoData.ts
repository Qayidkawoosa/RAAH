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

export const demoComplaints: Complaint[] = [
  {
    id: createId('cmp'),
    busNo: 'JK-01-D-2296',
    parentName: 'Rafiq Wani',
    text: 'The bus was driving very fast near Soura this morning, my son said the driver overtook two cars on a blind turn. Please look into this.',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    status: 'open',
  },
  {
    id: createId('cmp'),
    busNo: 'JK-01-B-4472',
    parentName: 'Shabnam Mir',
    text: 'Bus reached the stop 25 minutes late two days in a row without any notice. Children were waiting in the cold.',
    createdAt: Date.now() - DAY_MS,
    status: 'reviewing',
  },
  {
    id: createId('cmp'),
    busNo: DEMO_BUS_NO,
    parentName: 'Imran Bhat',
    text: 'One of the rear seats is broken and the window does not close properly. Needs maintenance before winter.',
    createdAt: Date.now() - 3 * DAY_MS,
    status: 'resolved',
  },
];

export const demoCompliance: ComplianceRecord[] = [];

export const demoStudents: Student[] = [
  { id: 'stu_1', name: 'Ayaan Bhat', className: 'Class 5-A', busNo: DEMO_BUS_NO, parentName: 'Amina Shah', pickupStop: 'Lal Chowk' },
  { id: 'stu_2', name: 'Zoya Mir', className: 'Class 3-B', busNo: DEMO_BUS_NO, parentName: 'Shabnam Mir', pickupStop: 'Khanyar' },
  { id: 'stu_3', name: 'Rehan Wani', className: 'Class 7-A', busNo: 'JK-01-B-4472', parentName: 'Rafiq Wani', pickupStop: 'Hawal' },
  { id: 'stu_4', name: 'Mehak Lone', className: 'Class 4-C', busNo: 'JK-01-B-4472', parentName: 'Sajad Lone', pickupStop: 'Nowhatta' },
  { id: 'stu_5', name: 'Ibrahim Dar', className: 'Class 6-B', busNo: 'JK-01-D-2296', parentName: 'Imran Bhat', pickupStop: 'Naseem Bagh' },
  { id: 'stu_arman', name: 'Arman', className: 'Class 4-A', busNo: DEMO_BUS_NO, parentName: 'Amina Shah', pickupStop: 'Nowhatta' },
];

export const demoViolations: ViolationRecord[] = [
  { id: createId('vio'), busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Overspeeding', detail: '67 km/h in a 50 km/h zone near Soura', date: '13 Jul 2026', severity: 'high' },
  { id: createId('vio'), busNo: DEMO_BUS_NO, driverName: DEMO_DRIVER_NAME, type: 'Overspeeding', detail: '58 km/h on Boulevard Road', date: '12 Jul 2026', severity: 'medium' },
  { id: createId('vio'), busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Route Deviation', detail: '600 m off route near Anchar', date: '11 Jul 2026', severity: 'high' },
  { id: createId('vio'), busNo: 'JK-01-B-4472', driverName: 'Bashir Ahmad', type: 'Long Stop', detail: 'Unscheduled 9 minute stop at Dalgate', date: '10 Jul 2026', severity: 'low' },
  { id: createId('vio'), busNo: 'JK-01-E-6634', driverName: 'Abdul Majid', type: 'Overspeeding', detail: '55 km/h near HMT crossing', date: '09 Jul 2026', severity: 'low' },
  { id: createId('vio'), busNo: 'JK-01-D-2296', driverName: 'Farooq Lone', type: 'Overdue Inspection', detail: 'Last inspected 03 Feb 2026 — past the 6-month limit', date: '08 Jul 2026', severity: 'high' },
];

export const demoAnalytics: AnalyticsSummary = {
  totalTripsToday: 18,
  activeTrips: 3,
  totalViolationsWeek: 6,
  avgFleetSafetyScore: 86,
  complianceRate: 80,
  sosCountMonth: 1,
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
