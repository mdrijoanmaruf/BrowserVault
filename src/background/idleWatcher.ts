/**
 * Idle Watcher — Day 7
 *
 * Listens to chrome.idle.onStateChanged. When the browser becomes
 * idle (or the system is locked) and idle mode is enabled in settings,
 * triggers lockController.lockBrowser().
 */

import { lockBrowser } from './lockController';
import type { UserSettings } from '@/types';

// ─────────────────────────────────────────────────────────────
// Internal state
// ─────────────────────────────────────────────────────────────

let _watching = false;
let _currentListener: ((state: chrome.idle.IdleState) => void) | null = null;

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Starts watching for idle state changes based on user settings.
 * If a watcher is already running, it is stopped first.
 *
 * @param settings - Current user settings
 */
export function startIdleWatcher(settings: Pick<UserSettings, 'idleModeEnabled' | 'idleDurationMinutes'>): void {
  // Always stop the existing watcher before (re)starting
  stopIdleWatcher();

  if (!settings.idleModeEnabled) {
    console.log('[BrowserVault] Idle watcher disabled by settings');
    return;
  }

  const intervalSeconds = settings.idleDurationMinutes * 60;

  // Minimum Chrome allows is 15 seconds
  const clampedSeconds = Math.max(15, intervalSeconds);
  chrome.idle.setDetectionInterval(clampedSeconds);

  _currentListener = async (idleState: chrome.idle.IdleState) => {
    console.log(`[BrowserVault] Idle state changed to: ${idleState}`);
    if (idleState === 'idle' || idleState === 'locked') {
      console.log('[BrowserVault] Idle threshold reached — locking browser');
      await lockBrowser();
    }
  };

  chrome.idle.onStateChanged.addListener(_currentListener);
  _watching = true;

  console.log(
    `[BrowserVault] Idle watcher started — threshold: ${settings.idleDurationMinutes} min`
  );
}

/**
 * Stops the idle watcher and removes the listener from chrome.idle.onStateChanged.
 */
export function stopIdleWatcher(): void {
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
