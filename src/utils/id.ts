let counter = 0;

/** Unique-enough id for client-side entities (trips, events, alerts). */
export const createId = (prefix: string): string => {
  counter = (counter + 1) % 1000;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
};
