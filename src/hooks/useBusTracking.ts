import { useEffect, useState } from 'react';
import { BusLiveState, TripEvent } from '../types/trip';
import { realtimeService } from '../services/realtime';
import { isLiveBackend } from '../config/env';
import { busSimulator } from '../services/demo/busSimulator';

interface BusTracking {
  bus: BusLiveState | null;
  events: TripEvent[];
  isLive: boolean;
}

/** Live position + safety events for a bus (parent / school / RTO views). */
export const useBusTracking = (busNo: string): BusTracking => {
  const [bus, setBus] = useState<BusLiveState | null>(null);
  const [events, setEvents] = useState<TripEvent[]>(
    isLiveBackend ? [] : busSimulator.getRecentEvents(busNo)
  );

  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToBus(
      busNo,
      (state) => setBus(state),
      (event) => setEvents((current) => [event, ...current].slice(0, 30))
    );
    return unsubscribe;
  }, [busNo]);

  return { bus, events, isLive: bus !== null };
};
