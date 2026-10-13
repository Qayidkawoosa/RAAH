export const SPEED_LIMIT_KMH = 50;

/** A stop longer than this (ms) outside a bus stop raises a long-stop event. */
export const LONG_STOP_THRESHOLD_MS = 90_000;

/** Speed below this (km/h) counts as "stopped". */
export const STOPPED_SPEED_KMH = 3;

/** Distance from the planned route (meters) that counts as a deviation. */
export const ROUTE_DEVIATION_THRESHOLD_M = 250;

/** Minimum gap (ms) between two alerts of the same type. */
export const EVENT_COOLDOWN_MS = 30_000;

/** Assumed average bus speed for ETA estimates when moving slowly. */
export const ETA_FALLBACK_SPEED_KMH = 24;
