import { TripStatus } from './trip';
import { ComplaintAnalysis, RiskLevel } from './ai';

export interface FleetBus {
  busNo: string;
  driverName: string;
  routeName: string;
  status: TripStatus;
  studentsOnBoard: number;
  safetyScore: number;
}

export interface DriverRanking {
  driverId: string;
  driverName: string;
  busNo: string;
  safetyScore: number;
  tripsCompleted: number;
  violations: number;
  trend: 'up' | 'down' | 'flat';
}

export interface Student {
  id: string;
  name: string;
  className: string;
  busNo: string;
  parentName?: string;
  /** Stop where this student boards the bus. */
  pickupStop?: string;
}

export type ComplaintStatus = 'open' | 'reviewing' | 'resolved';

export interface Complaint {
  id: string;
  busNo: string;
  parentName: string;
  text: string;
  createdAt: number;
  status: ComplaintStatus;
  analysis?: ComplaintAnalysis;
}

export interface ComplianceRecord {
  busNo: string;
  schoolName: string;
  routeName: string;
  insuranceValidTill: string;
  lastInspection: string;
  isCompliant: boolean;
}

export interface ViolationRecord {
  id: string;
  busNo: string;
  driverName: string;
  type: string;
  detail: string;
  date: string;
  severity: RiskLevel;
}

export interface AnalyticsSummary {
  totalTripsToday: number;
  activeTrips: number;
  totalViolationsWeek: number;
  avgFleetSafetyScore: number;
  complianceRate: number;
  sosCountMonth: number;
}

export type SafetyEventSource = 'driver_cam' | 'cabin_cam' | 'imu' | 'gps' | 'device';
export type SafetyEventType = 'drowsiness' | 'distraction' | 'yawn' | 'phone_use' | 'hands_off' | 'seatbelt_off' | 'smoking_suspected' | 'identity_mismatch' | 'tamper' | 'occupancy' | 'overcrowding' | 'left_behind' | 'standing_while_moving' | 'possible_altercation' | 'harsh_braking' | 'overspeed';
export type SafetyEventSeverity = 'info' | 'warn' | 'critical';
export type SafetyEventStatus = 'auto_flagged' | 'under_review' | 'confirmed' | 'dismissed' | 'disputed';

export interface SafetyEvent {
  event_id: string;
  trip_id: string;
  bus_id: string;
  driver_id: string;
  school_id: string;
  source: SafetyEventSource;
  type: SafetyEventType;
  severity: SafetyEventSeverity;
  confidence: number;
  status: SafetyEventStatus;
  detected_at: string;
  lat: number;
  lng: number;
  speed_kmph: number;
  duration_ms: number;
  clip_ref: string | null;
  thumbnail_ref: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}
