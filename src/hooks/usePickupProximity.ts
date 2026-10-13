import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';
import { BusLiveState, BusStop } from '../types/trip';
import { DEMO_ROUTE_PATH } from '../constants/demoRoute';
import { remainingPathMeters } from '../utils/geo';
import { ETA_FALLBACK_SPEED_KMH } from '../constants/safety';

export type PickupPhase = 'far' | 'approaching' | 'imminent' | 'arrived' | 'passed';

interface PickupProximity {
  /** Road distance from the bus to the pickup stop, in meters. */
  distanceM: number | null;
  etaMinutes: number | null;
  phase: PickupPhase | null;
}

/** Simulated clock runs 14x faster than real time (matches the demo bus). */
const TIME_LAPSE = 14;

/**
 * Tracks how far the bus is from the parent's pickup stop along the route
 * and vibrates the phone when it crosses the get-ready thresholds
 * (≈1 km → "approaching", ≈500 m → "imminent", at the stop → "arrived").
 */
export const usePickupProximity = (
  bus: BusLiveState | null,
  stop: BusStop | null
): PickupProximity => {
  const [state, setState] = useState<PickupProximity>({
    distanceM: null,
    etaMinutes: null,
    phase: null,
  });
  const lastPhase = useRef<PickupPhase | null>(null);

  useEffect(() => {
    if (!bus || !stop) {
      lastPhase.current = null;
      setState({ distanceM: null, etaMinutes: null, phase: null });
      return;
    }

    const busRemaining = remainingPathMeters(bus.location, DEMO_ROUTE_PATH);
    const stopRemaining = remainingPathMeters(stop.location, DEMO_ROUTE_PATH);
    const distanceM = busRemaining - stopRemaining;

    const effectiveSpeed = Math.max(bus.speedKmh, ETA_FALLBACK_SPEED_KMH) * TIME_LAPSE;
    const etaMinutes =
      distanceM > 0 ? Math.max(1, Math.round(distanceM / 1000 / (effectiveSpeed / 60))) : 0;

    const phase: PickupPhase =
      distanceM < -150
        ? 'passed'
        : distanceM <= 120
          ? 'arrived'
          : etaMinutes <= 2
            ? 'imminent'
            : etaMinutes <= 5
              ? 'approaching'
              : 'far';

    // Vibrate once per threshold crossing, never repeatedly.
    const alertPhases: PickupPhase[] = ['approaching', 'imminent', 'arrived'];
    if (alertPhases.includes(phase) && lastPhase.current !== phase) {
      Vibration.vibrate([0, 300, 150, 300]);
    }
    lastPhase.current = phase;

    setState({ distanceM: Math.max(0, Math.round(distanceM)), etaMinutes, phase });
  }, [bus, stop]);

  return state;
};
