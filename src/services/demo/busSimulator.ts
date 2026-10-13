import { BusLiveState, BusStop, TripEvent, TripPoint, LatLng } from '../../types/trip';
import { ALL_ROUTES, RouteConfig, DEMO_BUS_NO } from '../../constants/demoRoute';
import { ETA_FALLBACK_SPEED_KMH } from '../../constants/safety';
import { bearingDegrees, distanceMeters, interpolate } from '../../utils/geo';
import { TripMonitor } from '../../utils/tripMonitor';
import { createId } from '../../utils/id';

type StateListener = (state: BusLiveState) => void;
type EventListener = (event: TripEvent) => void;

const TICK_MS = 1000;
const TIME_LAPSE = 14;
/** Ticks the bus waits at each terminal between trips. */
const DWELL_TICKS = 40;

class SingleBusSimulator {
  private routeConfig: RouteConfig;

  private stateListeners = new Set<StateListener>();

  private eventListeners = new Set<EventListener>();

  private timer: ReturnType<typeof setInterval> | null = null;

  private monitor: TripMonitor;

  private outbound = true;

  private segment = 0;

  private progress = 0;

  private tick = 0;

  private pauseTicks = 0;

  private dwellTicks = 0;

  private boardingTicks = 0;

  private boardedStops = new Set<string>();

  private state: BusLiveState;

  private recentEvents: TripEvent[] = [];

  constructor(routeConfig: RouteConfig) {
    this.routeConfig = routeConfig;
    this.monitor = new TripMonitor(this.routeConfig.path);
    this.state = this.buildInitialState();
  }

  private buildInitialState(): BusLiveState {
    const route = this.routeConfig.path;
    const stops = this.routeConfig.stops;
    return {
      busNo: this.routeConfig.busNo,
      tripId: createId('trip'),
      driverName: this.routeConfig.driverName,
      status: 'active',
      location: route[0],
      heading: bearingDegrees(route[0], route[1] || route[0]),
      speedKmh: 0,
      etaMinutes: 28,
      nextStop: stops[1]?.name ?? stops[0]?.name ?? 'School',
      updatedAt: Date.now(),
    };
  }

  getSnapshot(): BusLiveState {
    return this.state;
  }

  getRecentEvents(): TripEvent[] {
    return [...this.recentEvents];
  }

  subscribe(onState: StateListener, onEvent?: EventListener): () => void {
    this.stateListeners.add(onState);
    if (onEvent) this.eventListeners.add(onEvent);
    onState(this.state);
    this.ensureRunning();
    return () => {
      this.stateListeners.delete(onState);
      if (onEvent) this.eventListeners.delete(onEvent);
      this.stopIfIdle();
    };
  }

  private ensureRunning(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.step(), TICK_MS);
  }

  private stopIfIdle(): void {
    if (this.stateListeners.size > 0 || this.eventListeners.size > 0) return;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private route(): LatLng[] {
    return this.outbound ? this.routeConfig.path : [...this.routeConfig.path].reverse();
  }

  private stops(): BusStop[] {
    return this.outbound ? this.routeConfig.stops : [...this.routeConfig.stops].reverse();
  }

  private speedForTick(): number {
    if (this.pauseTicks > 0) return 0;
    // Each bus has a slightly different speed profile based on busNo to not stay perfectly in sync
    const variance = (this.routeConfig.busNo.charCodeAt(this.routeConfig.busNo.length - 1) ?? 0) % 5;
    if (this.tick >= (40 + variance * 4) && this.tick <= (52 + variance * 4)) {
      return 56 + Math.random() * 8; // overspeed burst
    }
    return 30 + Math.sin(this.tick / 6) * 8 + Math.random() * 4;
  }

  private step(): void {
    const route = this.route();
    const stops = this.stops();
    const terminal = stops[stops.length - 1].name;

    // Dwelling at a terminal between trips.
    if (this.dwellTicks > 0) {
      this.dwellTicks -= 1;
      this.state = {
        ...this.state,
        status: 'completed',
        location: route[route.length - 1],
        speedKmh: 0,
        etaMinutes: 0,
        nextStop: terminal,
        updatedAt: Date.now(),
      };
      if (this.dwellTicks === 0) {
        this.outbound = !this.outbound;
        this.segment = 0;
        this.progress = 0;
        this.tick = 0;
        this.boardedStops = new Set();
        this.monitor = new TripMonitor(this.routeConfig.path);
        this.state = { ...this.state, tripId: createId('trip') };
        this.publishEvent({
          id: createId('evt'),
          type: 'trip_started',
          message: this.outbound
            ? `Morning trip started from ${stops[0].name}`
            : `Return trip started from ${stops[0].name}`,
          timestamp: Date.now(),
        });
      }
      this.stateListeners.forEach((listener) => listener(this.state));
      return;
    }

    // Briefly halted at a stop to board students.
    if (this.boardingTicks > 0) {
      this.boardingTicks -= 1;
      this.state = { ...this.state, speedKmh: 0, updatedAt: Date.now() };
      this.stateListeners.forEach((listener) => listener(this.state));
      return;
    }

    this.tick += 1;
    // Scripted pause around 40% along the route
    const pauseSegment = Math.floor(route.length * 0.4);
    if (this.outbound && this.segment === pauseSegment && this.pauseTicks === 0 && this.progress < 0.1) {
      this.pauseTicks = 100; // scripted long stop
    }
    if (this.pauseTicks > 0) this.pauseTicks -= 1;

    const speedKmh = this.speedForTick();
    this.advance((speedKmh / 3.6) * (TICK_MS / 1000) * TIME_LAPSE);

    // Arrived at the terminal: complete the trip and dwell.
    if (this.segment >= route.length - 1) {
      this.dwellTicks = DWELL_TICKS;
      this.publishEvent({
        id: createId('evt'),
        type: 'trip_ended',
        message: `Trip completed at ${terminal}`,
        timestamp: Date.now(),
        location: route[route.length - 1],
      });
      return;
    }

    // Passing a pickup stop: halt for a few seconds to board students.
    const boardingStop = stops.find(
      (stop) =>
        stop.name !== terminal &&
        !this.boardedStops.has(stop.name) &&
        distanceMeters(
          interpolate(route[this.segment], route[Math.min(this.segment + 1, route.length - 1)], this.progress),
          stop.location
        ) < 120
    );
    if (boardingStop) {
      this.boardedStops.add(boardingStop.name);
      this.boardingTicks = 7;
    }

    const next = Math.min(this.segment + 1, route.length - 1);
    const location = interpolate(route[this.segment], route[next], this.progress);

    let remainingM = distanceMeters(location, route[next]);
    for (let i = next; i < route.length - 1; i += 1) {
      remainingM += distanceMeters(route[i], route[i + 1]);
    }
    const nextStopEntry = stops.find(
      (stop) => distanceMeters(location, stop.location) < remainingM
    );
    const etaSpeed = Math.max(speedKmh, ETA_FALLBACK_SPEED_KMH) * TIME_LAPSE;

    this.state = {
      ...this.state,
      location,
      speedKmh,
      heading: bearingDegrees(route[this.segment], route[next]),
      etaMinutes: Math.max(1, Math.round(remainingM / 1000 / (etaSpeed / 60))),
      nextStop: nextStopEntry?.name ?? terminal,
      status: 'active',
      updatedAt: Date.now(),
    };

    const point: TripPoint = { ...location, timestamp: Date.now(), speedKmh };
    this.monitor.addPoint(point).forEach((event) => this.publishEvent(event));

    this.stateListeners.forEach((listener) => listener(this.state));
  }

  private advance(meters: number): void {
    const route = this.route();
    let remaining = meters;
    while (remaining > 0 && this.segment < route.length - 1) {
      const from = route[this.segment];
      const to = route[this.segment + 1];
      const segmentLength = distanceMeters(from, to);
      const left = segmentLength * (1 - this.progress);
      if (remaining < left) {
        this.progress += remaining / segmentLength;
        remaining = 0;
      } else {
        remaining -= left;
        this.segment += 1;
        this.progress = 0;
      }
    }
  }

  private publishEvent(event: TripEvent): void {
    this.recentEvents = [event, ...this.recentEvents].slice(0, 20);
    this.eventListeners.forEach((listener) => listener(event));
  }
}

class MultiBusSimulator {
  private simulators = new Map<string, SingleBusSimulator>();

  constructor() {
    ALL_ROUTES.forEach((route) => {
      this.simulators.set(route.busNo, new SingleBusSimulator(route));
    });
  }

  private getSimulator(busNo: string): SingleBusSimulator {
    let sim = this.simulators.get(busNo);
    if (!sim) {
      // Fallback route configuration for unrecognized bus numbers
      const routeA = ALL_ROUTES[0];
      const customConfig: RouteConfig = {
        ...routeA,
        busNo,
        routeName: `Route for ${busNo}`,
      };
      sim = new SingleBusSimulator(customConfig);
      this.simulators.set(busNo, sim);
    }
    return sim;
  }

  getSnapshot(busNo: string = DEMO_BUS_NO): BusLiveState {
    return this.getSimulator(busNo).getSnapshot();
  }

  getRecentEvents(busNo: string = DEMO_BUS_NO): TripEvent[] {
    return this.getSimulator(busNo).getRecentEvents();
  }

  subscribe(busNo: string, onState: StateListener, onEvent?: EventListener): () => void {
    return this.getSimulator(busNo).subscribe(onState, onEvent);
  }
}

export const busSimulator = new MultiBusSimulator();
