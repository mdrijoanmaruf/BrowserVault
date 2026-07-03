/**
 * Service Worker Entry Point — background/index.ts
 *
 * Initialises the message router, lock state, and idle watcher on startup.
 * Handles the core message actions: GET_STATE, LOCK_BROWSER, UNLOCK_BROWSER, UPDATE_SETTINGS.
 */

import { MessageRouter } from './messageRouter';
import { lockBrowser, unlockBrowser, getLockStatus } from './lockController';
import { startIdleWatcher, stopIdleWatcher } from './idleWatcher';
import { storage } from '@/lib/storage';
import { STORAGE_KEYS, DEFAULT_USER_SETTINGS } from '@/lib/constants';
import type { UserSettings } from '@/types';

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

const router = new MessageRouter();

async function initializeState(): Promise<void> {
  const lockState = await getLockStatus();
  console.log('[BrowserVault] Service Worker started. Lock state:', lockState);

  // Load settings and start idle watcher if enabled
  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  startIdleWatcher(settings);
}

// ─────────────────────────────────────────────────────────────
// Message Routes
// ─────────────────────────────────────────────────────────────

/** Returns the current persisted lock state */
router.on('GET_STATE', async () => {
  return await getLockStatus();
});

/** Locks the browser and broadcasts the overlay to all tabs */
router.on('LOCK_BROWSER', async () => {
  await lockBrowser();
  return { success: true };
});

/**
 * Unlocks the browser.
 * Expects payload: { password: string }
 */
router.on('UNLOCK_BROWSER', async (payload: { password?: string }) => {
  const password = payload?.password ?? '';
  const result = await unlockBrowser(password);
  return result;
});

/**
 * Updates user settings and restarts the idle watcher with the new configuration.
 * Expects payload: Partial<UserSettings>
 */
router.on('UPDATE_SETTINGS', async (payload: Partial<UserSettings>) => {
  const current =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;
  const updated: UserSettings = { ...current, ...payload };
  await storage.setItem<UserSettings>(STORAGE_KEYS.SETTINGS, updated);

  // Restart the idle watcher with updated settings
  stopIdleWatcher();
  startIdleWatcher(updated);

  console.log('[BrowserVault] Settings updated:', updated);
  return { success: true, settings: updated };
});

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

router.listen();
initializeState();
