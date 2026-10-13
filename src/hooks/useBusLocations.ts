import { useEffect, useState } from 'react';
import ROUTES from '../constants/routes.generated.json';

export type BusStatus = 'on_route' | 'at_stop' | 'delayed' | 'signal_lost' | 'sos' | 'completed';

export interface BusLocation {
  busId: string;
  latitude: number;
  longitude: number;
  heading: number;
  speedKmh: number;
  status: BusStatus;
  etaMinutes: number;
  nextStopName: string;
  lastUpdated: number;
  schoolName?: string;
  driverName?: string;
  complianceStatus?: string;
}

const mockLocations: Record<string, BusLocation> = {
  'JK-01-A-1234': {
    busId: 'JK-01-A-1234',
    latitude: 34.1347,
    longitude: 74.8008,
    heading: 45,
    speedKmh: 35,
    status: 'on_route',
    etaMinutes: 12,
    nextStopName: 'Hazratbal',
    lastUpdated: Date.now(),
    schoolName: 'Kashmir Valley School',
    driverName: 'Jehangir Dar',
    complianceStatus: 'Compliant'
  },
  'JK-01-B-9988': {
    busId: 'JK-01-B-9988',
    latitude: 34.0833,
    longitude: 74.7950,
    heading: 120,
    speedKmh: 52,
    status: 'delayed', // Overspeeding/Delayed incident
    etaMinutes: 5,
    nextStopName: 'Lal Chowk',
    lastUpdated: Date.now(),
    schoolName: 'Burn Hall School',
    driverName: 'Tariq Bhat',
    complianceStatus: 'Insurance Expired'
  },
  'JK-01-C-5544': {
    busId: 'JK-01-C-5544',
    latitude: 34.0620,
    longitude: 74.8010,
    heading: 270,
    speedKmh: 0,
    status: 'sos', // SOS incident
    etaMinutes: 20,
    nextStopName: 'Jawahar Nagar',
    lastUpdated: Date.now(),
    schoolName: 'Presentation Convent',
    driverName: 'Sameer Khan',
    complianceStatus: 'Compliant'
  }
};

/**
 * Hook to get simulated bus locations.
 * In a real app, this would subscribe to the simulatorService.
 */
export function useBusLocations(busId?: string) {
  const [locations, setLocations] = useState<Record<string, BusLocation>>(mockLocations);

  useEffect(() => {
    // Simple interval to simulate "lastUpdated" ticks
    const interval = setInterval(() => {
      setLocations(prev => {
        const next = { ...prev };
        for (const id in next) {
          next[id] = { ...next[id], lastUpdated: Date.now() };
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return {
    locations,
    location: busId ? locations[busId] || null : null,
  };
}
