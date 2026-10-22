import { useEffect, useState } from 'react';
import { realtimeService } from '../services/realtime';
import { tripService } from '../services/tripService';
import { BusLiveState } from '../types/trip';

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
  routeName?: string;
  routeId?: string;
  endedAtLocation?: { latitude: number; longitude: number };
}

const initialLocations: Record<string, BusLocation> = {};
export const mockLocations = initialLocations;

/**
 * Hook to get real-time bus locations dynamically.
 */
export function useBusLocations(busId?: string) {
  const [locations, setLocations] = useState<Record<string, BusLocation>>(initialLocations);

  useEffect(() => {
    let unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const setupSubscriptions = async () => {
      // 1. Global Socket.IO listener for any bus:state on the server
      const socket = (realtimeService as any).ensureSocket?.();
      const handleBusState = (state: BusLiveState) => {
        if (!state?.busNo || !state.location) return;

        setLocations((prev) => ({
          ...prev,
          [state.busNo]: {
            busId: state.busNo,
            latitude: state.location.latitude,
            longitude: state.location.longitude,
            heading: state.heading || 0,
            speedKmh: state.speedKmh || 0,
            status: (state.status as BusStatus) || 'on_route',
            lastUpdated: Date.now(),
            driverName: state.driverName || prev[state.busNo]?.driverName || 'Driver',
            etaMinutes: state.etaMinutes ?? prev[state.busNo]?.etaMinutes ?? 0,
            nextStopName: state.nextStop || prev[state.busNo]?.nextStopName || '',
            schoolName: prev[state.busNo]?.schoolName || 'Kashmir Valley School',
            complianceStatus: prev[state.busNo]?.complianceStatus || 'Compliant',
            routeName: (state as any).routeName || prev[state.busNo]?.routeName,
            routeId: (state as any).routeId || prev[state.busNo]?.routeId,
            endedAtLocation: (state as any).endedAtLocation || prev[state.busNo]?.endedAtLocation,
          },
        }));
      };

      const handleBusOffline = (data: { busNo: string }) => {
        if (!data?.busNo) return;
        const target = data.busNo.toUpperCase().trim();
        setLocations((prev) => {
          const next = { ...prev };
          delete next[target];
          delete next[data.busNo];
          return next;
        });
      };

      if (socket) {
        socket.on('bus:state', handleBusState);
        socket.on('bus:offline', handleBusOffline);
        unsubscribes.push(() => {
          socket.off('bus:state', handleBusState);
          socket.off('bus:offline', handleBusOffline);
        });
      }

      // 2. Specific per-bus subscriptions for rooms
      const defaultBuses = ['BUS-04', 'BUS-07', 'BUS-12', 'JK-01-A-1234'];
      const busSet = new Set<string>(defaultBuses);

      if (busId) {
        busSet.add(busId);
      }

      try {
        const fleet = await tripService.getFleet();
        fleet.forEach((b) => {
          if (b.busNo) busSet.add(b.busNo);
        });
      } catch {
        // keep default set
      }

      if (!isMounted) return;

      const busList = Array.from(busSet);

      busList.forEach((id) => {
        const unsub = realtimeService.subscribeToBus(id, handleBusState);
        unsubscribes.push(unsub);
      });
    };

    setupSubscriptions();

    return () => {
      isMounted = false;
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [busId]);

  return {
    locations,
    location: busId ? locations[busId] || null : null,
  };
}
