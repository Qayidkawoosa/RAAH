// Server-side demo bus: drives Srinagar routes so parent/school/RTO
// dashboards are live the moment the server is up — no driver phone needed.
// Lifecycle mirrors a real school bus: outbound trip → completed + dwell at
// the school → return trip → dwell → repeat. Yields to real drivers.

import { ALL_ROUTES } from './routeData.js';

const TIME_LAPSE = 14;
/** Seconds the bus waits at each terminal between trips. */
const DWELL_TICKS = 40;

const toRad = (d) => (d * Math.PI) / 180;
const distM = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const lerp = (a, b, t) => ({
  latitude: a.latitude + (b.latitude - a.latitude) * t,
  longitude: a.longitude + (b.longitude - a.longitude) * t,
});
const bearing = (a, b) => {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x = Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

function startSingleBus(io, store, routeConfig) {
  const BUS_NO = routeConfig.busNo;
  const DRIVER = routeConfig.driverName;
  const ROUTE_OUT = routeConfig.path;
  const ROUTE_RET = [...routeConfig.path].reverse();

  const findClosestIndex = (loc, path) => {
    let min = Infinity;
    let index = 0;
    path.forEach((pt, i) => {
      const d = distM(loc, pt);
      if (d < min) {
        min = d;
        index = i;
      }
    });
    return index;
  };

  const STOPS_OUT = routeConfig.stops.map((stop) => ({
    name: stop.name,
    i: findClosestIndex(stop.location, ROUTE_OUT),
  }));

  const STOPS_RET = [...routeConfig.stops]
    .map((stop) => ({
      name: stop.name,
      i: findClosestIndex(stop.location, ROUTE_RET),
    }))
    .sort((a, b) => a.i - b.i);

  let outbound = true;
  let segment = 0;
  let progress = 0;
  let tick = 0;
  let pauseTicks = 0;
  let dwellTicks = 0;
  let boardingTicks = 0;
  let boardedStops = new Set();
  let tripId = `trip_${Date.now().toString(36)}_${BUS_NO.replace(/[^A-Za-z0-9]/g, '')}`;
  let lastOverspeedAt = 0;
  let longStopReported = false;

  const emitEvent = (type, message, location, speedKmh) => {
    const event = {
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      message,
      timestamp: Date.now(),
      location,
      speedKmh,
      busNo: BUS_NO,
    };
    io.to(`bus:${BUS_NO}`).emit('bus:event', event);
  };

  const publish = (state) => {
    store.liveBuses.set(BUS_NO, state);
    io.to(`bus:${BUS_NO}`).emit('bus:state', state);
  };

  setInterval(() => {
    // Yield to a real driver phone publishing for this bus.
    const current = store.liveBuses.get(BUS_NO);
    if (current && !current.isDemo && Date.now() - current.updatedAt < 8000) return;

    const route = outbound ? ROUTE_OUT : ROUTE_RET;
    const stops = outbound ? STOPS_OUT : STOPS_RET;
    const terminal = stops[stops.length - 1].name;

    // Dwelling at a terminal between trips.
    if (dwellTicks > 0) {
      dwellTicks -= 1;
      publish({
        busNo: BUS_NO,
        tripId,
        driverName: DRIVER,
        status: 'completed',
        location: route[route.length - 1],
        heading: 0,
        speedKmh: 0,
        etaMinutes: 0,
        nextStop: terminal,
        updatedAt: Date.now(),
        isDemo: true,
      });
      if (dwellTicks === 0) {
        // Turn around and start the next trip.
        outbound = !outbound;
        segment = 0;
        progress = 0;
        tick = 0;
        longStopReported = false;
        boardedStops = new Set();
        tripId = `trip_${Date.now().toString(36)}_${BUS_NO.replace(/[^A-Za-z0-9]/g, '')}`;
        emitEvent(
          'trip_started',
          outbound ? `Morning trip started from ${stops[0].name}` : `Return trip started from ${stops[0].name}`,
          (outbound ? ROUTE_OUT : ROUTE_RET)[0],
          0
        );
      }
      return;
    }

    // Briefly halted at a stop to board students.
    if (boardingTicks > 0) {
      boardingTicks -= 1;
      const prev = store.liveBuses.get(BUS_NO);
      if (prev) publish({ ...prev, speedKmh: 0, updatedAt: Date.now() });
      return;
    }

    tick += 1;
    const pauseSegment = Math.floor(route.length * 0.45);
    if (outbound && segment === pauseSegment && pauseTicks === 0 && progress < 0.1) pauseTicks = 100;
    if (pauseTicks > 0) pauseTicks -= 1;

    // Speed variance based on busNo
    const variance = (BUS_NO.charCodeAt(BUS_NO.length - 1) ?? 0) % 5;
    const speedKmh = pauseTicks > 0
      ? 0
      : tick >= (45 + variance * 3) && tick <= (58 + variance * 3)
        ? 56 + Math.random() * 8
        : 30 + Math.sin(tick / 7) * 8 + Math.random() * 4;

    let meters = (speedKmh / 3.6) * TIME_LAPSE;
    while (meters > 0 && segment < route.length - 1) {
      const len = distM(route[segment], route[segment + 1]);
      const left = len * (1 - progress);
      if (meters < left) {
        progress += meters / len;
        meters = 0;
      } else {
        meters -= left;
        segment += 1;
        progress = 0;
      }
    }

    // Arrived at the terminal: complete the trip and dwell.
    if (segment >= route.length - 1) {
      dwellTicks = DWELL_TICKS;
      emitEvent('trip_ended', `Trip completed at ${terminal}`, route[route.length - 1], 0);
      return;
    }

    // Passing a pickup stop: halt for a few seconds to board students.
    const boardingStop = stops.find(
      (s) => s.i > 0 && s.i < route.length - 1 && s.i <= segment && !boardedStops.has(s.name)
    );
    if (boardingStop) {
      boardedStops.add(boardingStop.name);
      boardingTicks = 7;
    }

    const next = Math.min(segment + 1, route.length - 1);
    const location = lerp(route[segment], route[next], progress);
    let remaining = distM(location, route[next]);
    for (let i = next; i < route.length - 1; i += 1) remaining += distM(route[i], route[i + 1]);
    const nextStop = (stops.find((s) => s.i > segment) ?? stops[stops.length - 1]).name;
    const etaSpeed = Math.max(speedKmh, 24) * TIME_LAPSE;

    publish({
      busNo: BUS_NO,
      tripId,
      driverName: DRIVER,
      status: 'active',
      location,
      heading: bearing(route[segment], route[next]),
      speedKmh,
      etaMinutes: Math.max(1, Math.round(remaining / 1000 / (etaSpeed / 60))),
      nextStop,
      updatedAt: Date.now(),
      isDemo: true,
    });

    if (speedKmh > 50 && Date.now() - lastOverspeedAt > 30000) {
      lastOverspeedAt = Date.now();
      emitEvent('overspeed', `Overspeeding detected: ${Math.round(speedKmh)} km/h in a 50 km/h zone`, location, speedKmh);
    }
    if (pauseTicks > 0 && pauseTicks < 10 && !longStopReported) {
      longStopReported = true;
      emitEvent('long_stop', `Unscheduled stop for 2+ minutes near ${nextStop}`, location, 0);
    }
  }, 1000);

  console.log(`  Demo bus ${BUS_NO} driving route: ${routeConfig.routeName} (yields to real drivers)`);
}

export function startDemoBus(io, store) {
  ALL_ROUTES.forEach((routeConfig) => {
    startSingleBus(io, store, routeConfig);
  });
}
