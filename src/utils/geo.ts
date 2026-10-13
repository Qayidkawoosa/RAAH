import { LatLng } from '../types/trip';

const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Great-circle distance between two points in meters. */
export const distanceMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

/** Initial bearing from a to b in degrees (0 = north). */
export const bearingDegrees = (a: LatLng, b: LatLng): number => {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/** Linear interpolation between two points. */
export const interpolate = (a: LatLng, b: LatLng, t: number): LatLng => ({
  latitude: a.latitude + (b.latitude - a.latitude) * t,
  longitude: a.longitude + (b.longitude - a.longitude) * t,
});

/** Shortest distance in meters from a point to a polyline path. */
export const distanceToPathMeters = (point: LatLng, path: LatLng[]): number => {
  let min = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i += 1) {
    const segmentMin = Math.min(
      distanceMeters(point, path[i]),
      distanceMeters(point, path[i + 1]),
      distanceMeters(point, interpolate(path[i], path[i + 1], 0.5))
    );
    min = Math.min(min, segmentMin);
  }
  return min;
};

/** Remaining distance in meters along the path from the nearest vertex. */
export const remainingPathMeters = (point: LatLng, path: LatLng[]): number => {
  let nearestIndex = 0;
  let nearest = Number.POSITIVE_INFINITY;
  path.forEach((vertex, index) => {
    const d = distanceMeters(point, vertex);
    if (d < nearest) {
      nearest = d;
      nearestIndex = index;
    }
  });
  let remaining = distanceMeters(point, path[nearestIndex]);
  for (let i = nearestIndex; i < path.length - 1; i += 1) {
    remaining += distanceMeters(path[i], path[i + 1]);
  }
  return remaining;
};

/** Total length of a path in kilometers. */
export const pathLengthKm = (path: LatLng[]): number => {
  let total = 0;
  for (let i = 0; i < path.length - 1; i += 1) {
    total += distanceMeters(path[i], path[i + 1]);
  }
  return total / 1000;
};
