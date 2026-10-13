import { formatClockTime, formatDuration } from '../utils/format';

export interface TripSchedule {
  id: string;
  name: string;
  hour: number;
  minute: number;
}

/** Daily trip timetable for every bus. */
export const TRIP_SCHEDULES: TripSchedule[] = [
  { id: 'morning', name: 'Morning Pickup', hour: 9, minute: 30 },
  { id: 'afternoon', name: 'Afternoon Drop', hour: 15, minute: 30 },
];

/** Tracking window: opens 15 min before the slot, closes 90 min after. */
const WINDOW_BEFORE_MS = 15 * 60_000;
const WINDOW_AFTER_MS = 90 * 60_000;

const occurrenceToday = (schedule: TripSchedule, now: Date): Date => {
  const date = new Date(now);
  date.setHours(schedule.hour, schedule.minute, 0, 0);
  return date;
};

/** The schedule whose tracking window contains `now`, if any. */
export const activeSchedule = (now: Date = new Date()): TripSchedule | null =>
  TRIP_SCHEDULES.find((schedule) => {
    const start = occurrenceToday(schedule, now).getTime();
    return now.getTime() >= start - WINDOW_BEFORE_MS && now.getTime() <= start + WINDOW_AFTER_MS;
  }) ?? null;

/** The next upcoming slot (today or tomorrow) and when it starts. */
export const nextSchedule = (
  now: Date = new Date()
): { schedule: TripSchedule; startsAt: Date } => {
  for (const schedule of TRIP_SCHEDULES) {
    const startsAt = occurrenceToday(schedule, now);
    if (startsAt.getTime() + WINDOW_AFTER_MS > now.getTime()) return { schedule, startsAt };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { schedule: TRIP_SCHEDULES[0], startsAt: occurrenceToday(TRIP_SCHEDULES[0], tomorrow) };
};

/** Slot time in the device's own clock format (respects 24-hour settings). */
export const formatScheduleTime = (schedule: TripSchedule, now: Date = new Date()): string =>
  formatClockTime(occurrenceToday(schedule, now).getTime());

/** "in 2h 10m" / "in 25 min" until the given time. */
export const formatTimeUntil = (date: Date, now: Date = new Date()): string =>
  `in ${formatDuration(date.getTime() - now.getTime())}`;
