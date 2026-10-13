import { LatLng, TripPoint } from '../../types/trip';
import { DEMO_ROUTE_PATH_A } from '../../constants/demoRoute';
import { distanceMeters, interpolate } from '../../utils/geo';

const TICK_MS = 1000;
const TIME_LAPSE = 14;

/**
 * Simulates the driver's own phone moving along the demo route. Used when
 * GPS permission is denied or unavailable (e.g. Android emulator), so the
 * driver demo always produces live telemetry — including one overspeed burst.
 */
export const startDriveSimulation = (
  onPoint: (point: TripPoint) => void,
  routePath: LatLng[] = DEMO_ROUTE_PATH_A
): (() => void) => {
  let segment = 0;
  let progress = 0;
  let tick = 0;

  const timer = setInterval(() => {
    tick += 1;
    const speedKmh =
      tick >= 40 && tick <= 52
        ? 56 + Math.random() * 8
        : 30 + Math.sin(tick / 6) * 8 + Math.random() * 4;

    let meters = (speedKmh / 3.6) * (TICK_MS / 1000) * TIME_LAPSE;
    while (meters > 0 && segment < routePath.length - 1) {
      const from = routePath[segment];
      const to = routePath[segment + 1];
      const segmentLength = distanceMeters(from, to);
      const left = segmentLength * (1 - progress);
      if (meters < left) {
        progress += meters / segmentLength;
        meters = 0;
      } else {
        meters -= left;
        segment += 1;
        progress = 0;
      }
    }
    if (segment >= routePath.length - 1) {
      segment = 0;
      progress = 0;
      tick = 0;
    }

    const location = interpolate(
      routePath[segment],
      routePath[Math.min(segment + 1, routePath.length - 1)],
      progress
    );
    onPoint({ ...location, timestamp: Date.now(), speedKmh });
  }, TICK_MS);

  return () => clearInterval(timer);
};
