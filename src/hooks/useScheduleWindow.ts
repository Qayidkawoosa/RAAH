import { useEffect, useState } from 'react';
import { TripSchedule, activeSchedule, nextSchedule } from '../constants/schedule';

interface ScheduleWindow {
  /** The schedule whose tracking window is open right now, if any. */
  inWindow: TripSchedule | null;
  /** The next slot to run, with the time it starts. */
  upcoming: { schedule: TripSchedule; startsAt: Date };
  /** The clock this view was computed from — pass to time formatters. */
  now: Date;
}

const read = (now: Date): ScheduleWindow => ({
  inWindow: activeSchedule(now),
  upcoming: nextSchedule(now),
  now,
});

/**
 * A self-refreshing view of the timetable. Every consumer gets the same
 * clock, so banners and countdowns can never go stale on one screen while
 * being fresh on another.
 */
export const useScheduleWindow = (refreshMs = 30_000): ScheduleWindow => {
  const [state, setState] = useState<ScheduleWindow>(() => read(new Date()));

  useEffect(() => {
    const timer = setInterval(() => setState(read(new Date())), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  return state;
};
