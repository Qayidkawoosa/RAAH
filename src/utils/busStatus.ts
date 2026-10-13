import { TripStatus } from '../types/trip';

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'neutral';

/** Each audience names the same states differently; tones never differ. */
export type StatusVocabulary = 'parent' | 'school' | 'rto';

const labels: Record<StatusVocabulary, Record<TripStatus, string>> = {
  parent: {
    sos: 'EMERGENCY',
    active: 'On the way',
    completed: 'Trip completed',
    idle: 'Not started',
  },
  school: { sos: 'SOS', active: 'Live', completed: 'Done', idle: 'Idle' },
  rto: { sos: 'SOS', active: 'Running', completed: 'Done', idle: 'Parked' },
};

const tones: Record<TripStatus, BadgeTone> = {
  sos: 'danger',
  active: 'success',
  completed: 'info',
  idle: 'neutral',
};

/**
 * One source of truth for how a bus status appears. Adding a TripStatus
 * means editing this file only, instead of a ternary chain per screen.
 */
export const busStatusBadge = (
  status: TripStatus | undefined,
  vocabulary: StatusVocabulary
): { label: string; tone: BadgeTone } => {
  const resolved: TripStatus = status ?? 'idle';
  return { label: labels[vocabulary][resolved], tone: tones[resolved] };
};
