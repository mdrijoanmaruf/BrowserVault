/**
 * Idle Watcher — Days 7 + 14
 *
 * Listens to chrome.idle.onStateChanged. When the browser becomes idle
 * and idle mode is enabled in settings, triggers lockController.lockBrowser().
 *
 * Day 14 addition:
 *  - If notifyBeforeLock is enabled, shows a warning notification
 *    notifyWarningSeconds before the lock fires, then locks after the delay.
 */

import { lockBrowser } from './lockController';
import { showNotification, clearNotification } from './notificationsManager';
import type { UserSettings } from '@/types';

// ─────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────

let _watching = false;
let _currentListener: ((state: chrome.idle.IdleState) => void) | null = null;
let _warnTimer: ReturnType<typeof setTimeout> | null = null;
let _lockTimer: ReturnType<typeof setTimeout> | null = null;

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function clearPendingTimers(): void {
  if (_warnTimer !== null) { clearTimeout(_warnTimer); _warnTimer = null; }
  if (_lockTimer !== null) { clearTimeout(_lockTimer); _lockTimer = null; }
  clearNotification('bv-idle-warning');
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export type IdleWatcherSettings = Pick<
  UserSettings,
  'idleModeEnabled' | 'idleDurationMinutes' | 'notifyBeforeLock'
>;

/**
 * Starts watching for idle state changes based on user settings.
 * Stops any existing watcher first.
 */
export function startIdleWatcher(settings: IdleWatcherSettings): void {
  stopIdleWatcher();

  if (!settings.idleModeEnabled) {
    console.log('[BrowserVault] Idle watcher disabled by settings');
    return;
  }

  const intervalSeconds = Math.max(15, settings.idleDurationMinutes * 60);
  chrome.idle.setDetectionInterval(intervalSeconds);

  /** Seconds before lock to show the pre-lock warning notification */
  const WARN_LEAD_SECONDS = 30;

  _currentListener = (idleState: chrome.idle.IdleState) => {
    console.log(`[BrowserVault] Idle state changed to: ${idleState}`);

    if (idleState === 'active') {
      // User came back — cancel any pending lock/warning
      clearPendingTimers();
      return;
    }

    if (idleState === 'idle' || idleState === 'locked') {
      clearPendingTimers();

      if (settings.notifyBeforeLock) {
        // Show warning notification WARN_LEAD_SECONDS before locking
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

/**
 * Stops the idle watcher and clears all pending timers.
 */
export function stopIdleWatcher(): void {
  clearPendingTimers();
  if (_currentListener) {
    chrome.idle.onStateChanged.removeListener(_currentListener);
    _currentListener = null;
  }
  _watching = false;
}

/**
 * Returns whether the idle watcher is currently active.
 */
export function isWatching(): boolean {
  return _watching;
}
