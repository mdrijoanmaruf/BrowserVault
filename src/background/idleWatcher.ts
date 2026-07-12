

import { lockBrowser } from './lockController';
import { showNotification, clearNotification } from './notificationsManager';
import type { UserSettings } from '@/types';



let _watching = false;
let _currentListener: ((state: 'active' | 'idle' | 'locked') => void) | null = null;
let _warnTimer: ReturnType<typeof setTimeout> | null = null;
let _lockTimer: ReturnType<typeof setTimeout> | null = null;



function clearPendingTimers(): void {
  if (_warnTimer !== null) { clearTimeout(_warnTimer); _warnTimer = null; }
  if (_lockTimer !== null) { clearTimeout(_lockTimer); _lockTimer = null; }
  clearNotification('bv-idle-warning');
}


export type IdleWatcherSettings = Pick<
  UserSettings,
  'idleModeEnabled' | 'idleDurationMinutes' | 'notifyBeforeLock' | 'autoLockOnSleep'
>;


export function startIdleWatcher(settings: IdleWatcherSettings): void {
  stopIdleWatcher();

  if (!settings.idleModeEnabled && !settings.autoLockOnSleep) {
    console.log('[BrowserVault] Idle watcher disabled by settings');
    return;
  }

  const intervalSeconds = settings.idleModeEnabled 
    ? Math.max(15, settings.idleDurationMinutes * 60)
    : 60; // default if only watching for sleep
    
  chrome.idle.setDetectionInterval(intervalSeconds);


  const WARN_LEAD_SECONDS = 30;

  _currentListener = (idleState: 'active' | 'idle' | 'locked') => {
    console.log(`[BrowserVault] Idle state changed to: ${idleState}`);

    if (idleState === 'active') {
      // User came back — cancel any pending lock/warning
      clearPendingTimers();
      return;
    }

    if (idleState === 'idle' || idleState === 'locked') {
      clearPendingTimers();

      if (idleState === 'locked' && settings.autoLockOnSleep) {
        console.log('[BrowserVault] System locked/sleeping — locking browser immediately');
        lockBrowser();
        return;
      }

      if (!settings.idleModeEnabled) return;

      if (settings.notifyBeforeLock) {
        _warnTimer = setTimeout(() => {
          showNotification(
            'bv-idle-warning',
            'BrowserVault — Locking Soon',
            `Your browser will lock in ${WARN_LEAD_SECONDS} seconds due to inactivity.`
          );
        }, 0); // Show immediately when idle threshold is hit

        // Lock after the warning lead time
        _lockTimer = setTimeout(async () => {
          clearNotification('bv-idle-warning');
          console.log('[BrowserVault] Idle threshold reached — locking browser');
          await lockBrowser();
        }, WARN_LEAD_SECONDS * 1000);
      } else {
        // No warning — lock immediately
        _lockTimer = setTimeout(async () => {
          console.log('[BrowserVault] Idle threshold reached — locking browser');
          await lockBrowser();
        }, 0);
      }
    }
  };

  chrome.idle.onStateChanged.addListener(_currentListener);
  _watching = true;

  console.log(
    `[BrowserVault] Idle watcher started — threshold: ${settings.idleDurationMinutes} min, notify: ${settings.notifyBeforeLock}`
  );
}

export function stopIdleWatcher(): void {
  clearPendingTimers();
  if (_currentListener) {
    chrome.idle.onStateChanged.removeListener(_currentListener);
    _currentListener = null;
  }
  _watching = false;
}


export function isWatching(): boolean {
  return _watching;
}
