import { LatLng, TripEvent, TripPoint } from '../types/trip';
import {
  EVENT_COOLDOWN_MS,
  LONG_STOP_THRESHOLD_MS,
  ROUTE_DEVIATION_THRESHOLD_M,
  SPEED_LIMIT_KMH,
  STOPPED_SPEED_KMH,
} from '../constants/safety';
import { distanceToPathMeters } from './geo';
import { createId } from './id';

/**
 * Pure safety-detection engine. Feed it GPS points during a trip and it
 * returns the safety events (overspeed, long stop, route deviation) that the
 * newest point triggers. Used identically by the driver app and the backend.
 */
export class TripMonitor {
  private readonly plannedRoute: LatLng[];

  private lastEventAt: Partial<Record<TripEvent['type'], number>> = {};

  private stopStartedAt: number | null = null;

  private stopReported = false;

  constructor(plannedRoute: LatLng[]) {
    this.plannedRoute = plannedRoute;
  }

  addPoint(point: TripPoint): TripEvent[] {
    const events: TripEvent[] = [];
    const overspeed = this.checkOverspeed(point);
    if (overspeed) events.push(overspeed);
    const longStop = this.checkLongStop(point);
    if (longStop) events.push(longStop);
    const deviation = this.checkDeviation(point);
    if (deviation) events.push(deviation);
    return events;
  }

  private isOnCooldown(type: TripEvent['type'], now: number): boolean {
    const last = this.lastEventAt[type];
    return last !== undefined && now - last < EVENT_COOLDOWN_MS;
  }

  private buildEvent(
    type: TripEvent['type'],
    message: string,
    point: TripPoint
  ): TripEvent {
    this.lastEventAt[type] = point.timestamp;
    return {
      id: createId('evt'),
      type,
      message,
      timestamp: point.timestamp,
      location: { latitude: point.latitude, longitude: point.longitude },
      speedKmh: point.speedKmh,
    };
  }

  private checkOverspeed(point: TripPoint): TripEvent | null {
    if (point.speedKmh <= SPEED_LIMIT_KMH) return null;
    if (this.isOnCooldown('overspeed', point.timestamp)) return null;
    return this.buildEvent(
      'overspeed',
      `Overspeeding detected: ${Math.round(point.speedKmh)} km/h in a ${SPEED_LIMIT_KMH} km/h zone`,
      point
    );
  }

  private checkLongStop(point: TripPoint): TripEvent | null {
    if (point.speedKmh > STOPPED_SPEED_KMH) {
      this.stopStartedAt = null;
      this.stopReported = false;
      return null;
    }
    if (this.stopStartedAt === null) {
      this.stopStartedAt = point.timestamp;
      return null;
    }
    const stoppedFor = point.timestamp - this.stopStartedAt;
    if (stoppedFor < LONG_STOP_THRESHOLD_MS || this.stopReported) return null;
    this.stopReported = true;
    return this.buildEvent(
      'long_stop',
      `Unscheduled stop for ${Math.round(stoppedFor / 60_000)}+ minutes`,
      point
    );
  }

  private checkDeviation(point: TripPoint): TripEvent | null {
    if (this.plannedRoute.length < 2) return null;
    const offRouteBy = distanceToPathMeters(point, this.plannedRoute);
    if (offRouteBy <= ROUTE_DEVIATION_THRESHOLD_M) return null;
    if (this.isOnCooldown('route_deviation', point.timestamp)) return null;
    const distanceLabel =
      offRouteBy >= 1000 ? `${(offRouteBy / 1000).toFixed(1)} km` : `${Math.round(offRouteBy)} m`;
    return this.buildEvent(
      'route_deviation',
      `Bus is ${distanceLabel} off the planned route`,
      point
    );
  }
}

/** 0–100 safety score from trip events; also used for live in-trip score. */
export const computeSafetyScore = (events: TripEvent[]): number => {
  const penalties: Partial<Record<TripEvent['type'], number>> = {
    overspeed: 8,
    long_stop: 5,
    route_deviation: 10,
    sos: 15,
  };
  const total = events.reduce(
    (sum, event) => sum + (penalties[event.type] ?? 0),
    0
  );
  return Math.max(35, 100 - total);
};
