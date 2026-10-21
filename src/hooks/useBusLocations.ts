import { useEffect, useState } from 'react';
import { realtimeService } from '../services/realtime';
import { BusLiveState } from '../types/trip';
import { ALL_ROUTES } from '../constants/demoRoute';

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

const initialLocations: Record<string, BusLocation> = {};
export const mockLocations = initialLocations;

/**
 * Hook to get real-time or simulated bus locations dynamically.
 */
export function useBusLocations(busId?: string) {
  const [locations, setLocations] = useState<Record<string, BusLocation>>(initialLocations);

  useEffect(() => {
    const busList = busId ? [busId] : ALL_ROUTES.map((r) => r.busNo);

    const unsubscribes = busList.map((id) =>
      realtimeService.subscribeToBus(id, (state: BusLiveState) => {
        if (!state?.busNo || !state.location) return;

        setLocations((prev) => ({
          ...prev,
          [state.busNo]: {
            busId: state.busNo,
            latitude: state.location.latitude,
            longitude: state.location.longitude,
            heading: state.heading || 0,
            speedKmh: state.speedKmh || 0,
            status: 'on_route',
            lastUpdated: Date.now(),
            driverName: state.driverName || 'Driver',
            etaMinutes: state.etaMinutes ?? prev[state.busNo]?.etaMinutes ?? 0,
            nextStopName: state.nextStop || prev[state.busNo]?.nextStopName || '',
            schoolName: prev[state.busNo]?.schoolName || 'Kashmir Valley School',
            complianceStatus: prev[state.busNo]?.complianceStatus || 'Compliant',
          },
        }));
      })
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [busId]);

  return {
    locations,
    location: busId ? locations[busId] || null : null,
  };
}
