
import { lockBrowser } from './lockController';
import type { UserSettings } from '@/types';

const SCHEDULE_ALARM_NAME = 'bv-scheduled-lock';

export function startScheduledLock(settings: UserSettings) {
  chrome.alarms.clear(SCHEDULE_ALARM_NAME);

  if (!settings.scheduledLockEnabled || !settings.scheduledLockTime) {
    return;
  }

  // Calculate next occurrence
  const [hours, minutes] = settings.scheduledLockTime.split(':').map(Number);
  const now = new Date();
  const nextOccurrence = new Date();
  
  nextOccurrence.setHours(hours, minutes, 0, 0);

  if (nextOccurrence.getTime() <= now.getTime()) {
    // If the time has already passed today, schedule for tomorrow
    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
  }

  chrome.alarms.create(SCHEDULE_ALARM_NAME, {
    when: nextOccurrence.getTime(),
    periodInMinutes: 24 * 60 // Repeat daily
  });

  console.log(`[BrowserVault] Scheduled lock set for ${nextOccurrence.toLocaleString()}`);
}

export function stopScheduledLock() {
  chrome.alarms.clear(SCHEDULE_ALARM_NAME);
}

// Alarm listener setup function
export function setupSchedulerListener() {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SCHEDULE_ALARM_NAME) {
      console.log(`[BrowserVault] Scheduled lock time reached. Locking browser.`);
      await lockBrowser();
    }
  });
}
