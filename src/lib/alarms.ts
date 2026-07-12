
const SCHEDULE_ALARM_NAME = 'bv-schedule-lock';

export interface ScheduleTime {
  hour: number;   // 0-23
  minute: number; // 0-59
}


export function setScheduledLock(time: ScheduleTime): void {
  const now = new Date();
  const next = new Date(now);
  next.setHours(time.hour, time.minute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  chrome.alarms.create(SCHEDULE_ALARM_NAME, {
    when: next.getTime(),
    periodInMinutes: 24 * 60, // repeat daily
  });
  console.log(`[BrowserVault] Lock alarm set for ${next.toLocaleTimeString()}`);
}


export function clearScheduledLock(): void {
  chrome.alarms.clear(SCHEDULE_ALARM_NAME, () => {
    console.log('[BrowserVault] Lock alarm cleared');
  });
}


export const SCHEDULE_ALARM = SCHEDULE_ALARM_NAME;
