/**
 * Alarms — Day 18
 *
 * Wrapper around chrome.alarms for scheduled locking.
 * Schedules a daily alarm at a specific time that triggers lockBrowser().
 */

const SCHEDULE_ALARM_NAME = 'bv-schedule-lock';

export interface ScheduleTime {
  hour: number;   // 0-23
  minute: number; // 0-59
}

/**
 * Creates (or replaces) a daily lock alarm at the given local time.
 */
export function setScheduledLock(time: ScheduleTime): void {
  const now = new Date();
  const next = new Date(now);
  next.setHours(time.hour, time.minute, 0, 0);
  if (next <= now) {
    // Already past today — schedule for tomorrow
    next.setDate(next.getDate() + 1);
  }
  chrome.alarms.create(SCHEDULE_ALARM_NAME, {
    when: next.getTime(),
    periodInMinutes: 24 * 60, // repeat daily
  });
  console.log(`[BrowserVault] Lock alarm set for ${next.toLocaleTimeString()}`);
}

/**
 * Removes the scheduled lock alarm.
 */
export function clearScheduledLock(): void {
  chrome.alarms.clear(SCHEDULE_ALARM_NAME, () => {
    console.log('[BrowserVault] Lock alarm cleared');
  });
}

/**
 * Returns the alarm name for the background service worker to listen on.
 */
export const SCHEDULE_ALARM = SCHEDULE_ALARM_NAME;
