export interface LatLng {
  latitude: number;
  longitude: number;
}

export type TripStatus = 'idle' | 'active' | 'sos' | 'completed';

export type TripEventType =
  | 'trip_started'
  | 'trip_ended'
  | 'overspeed'
  | 'long_stop'
  | 'route_deviation'
  | 'sos'
  | 'student_pickup'
  | 'overcrowding'
  | 'left_behind';

export interface TripEvent {
  id: string;
  type: TripEventType;
  message: string;
  timestamp: number;
  location?: LatLng;
  speedKmh?: number;
}

export interface TripPoint extends LatLng {
  timestamp: number;
  speedKmh: number;
}

import { SafetyReport, TripSummary } from './ai';

export interface Trip {
  id: string;
  busNo: string;
  driverId: string;
  driverName: string;
  routeName: string;
  status: TripStatus;
  startedAt: number;
  endedAt?: number;
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  safetyScore: number;
  events: TripEvent[];
  path: TripPoint[];
  aiSummary?: TripSummary;
  aiReport?: SafetyReport;
}

export interface BusStop {
  name: string;
  location: LatLng;
}

export interface BusLiveState {
  busNo: string;
  tripId: string | null;
  driverName: string;
  status: TripStatus;
  location: LatLng;
  heading: number;
  speedKmh: number;
  etaMinutes: number;
  nextStop: string;
  updatedAt: number;
}
