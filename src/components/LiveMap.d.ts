import React from 'react';
import { LatLng, BusStop } from '../types/trip';
import { Student } from '../types/fleet';

export interface LiveMapProps {
  busLocation?: LatLng | null;
  heading?: number;
  height?: number;
  followBus?: boolean;
  pickupLocation?: LatLng | null;
  idleBuses?: { busNo: string; location: LatLng }[];
  stopStudentCounts?: Record<string, number>;
  students?: Student[];
  isolatedStopName?: string | null;
  onExpand?: () => void;
  routePath?: LatLng[];
  stops?: BusStop[];
}

export const LiveMap: React.FC<LiveMapProps>;
