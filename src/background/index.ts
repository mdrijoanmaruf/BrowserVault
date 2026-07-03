/**
 * Service Worker Entry Point — background/index.ts
 *
 * Initialises the message router, lock state, and idle watcher on startup.
 * Routes: GET_STATE, LOCK_BROWSER, UNLOCK_BROWSER, SET_PASSWORD, UPDATE_SETTINGS
 */

import { MessageRouter } from './messageRouter';
import { lockBrowser, unlockBrowser, getLockStatus } from './lockController';
import { startIdleWatcher, stopIdleWatcher } from './idleWatcher';
import { storage } from '@/lib/storage';
import { STORAGE_KEYS, DEFAULT_USER_SETTINGS, DEFAULT_AUTH_STATE } from '@/lib/constants';
import { generateSalt, hashPassword } from '@/lib/crypto';
import type { UserSettings, AuthState } from '@/types';

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

const router = new MessageRouter();

async function initializeState(): Promise<void> {
  const lockState = await getLockStatus();
  console.log('[BrowserVault] Service Worker started. Lock state:', lockState);

  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  startIdleWatcher(settings);
}

// ─────────────────────────────────────────────────────────────
// Message Routes
// ─────────────────────────────────────────────────────────────

/** Returns both the current LockState and AuthState */
router.on('GET_STATE', async () => {
  const lockState = await getLockStatus();
  const authState =
    (await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE)) ??
    { ...DEFAULT_AUTH_STATE };
  return { lockState, authState };
});

/** Locks the browser and broadcasts the overlay to all tabs */
router.on('LOCK_BROWSER', async () => {
  await lockBrowser();
  return { success: true };
});

/**
 * Unlocks the browser after verifying the provided password.
 * Payload: { password: string }
 */
router.on('UNLOCK_BROWSER', async (payload: { password?: string }) => {
  const password = payload?.password ?? '';
  return await unlockBrowser(password);
});

/**
 * Stores a new password (first-time setup or password change).
 * Hashes with PBKDF2, stores hash + salt, marks hasPassword = true.
 * Payload: { password: string }
 */
router.on('SET_PASSWORD', async (payload: { password?: string }) => {
  const password = payload?.password;
  if (!password) {
    return { success: false, error: 'No password provided' };
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  await storage.setItem('vault_password_hash', hash);
  await storage.setItem('vault_password_salt', salt);

  // Mark password as configured in auth state
  const authState: AuthState =
    (await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE)) ??
    { ...DEFAULT_AUTH_STATE };
  authState.hasPassword = true;
  await storage.setItem<AuthState>(STORAGE_KEYS.AUTH_STATE, authState);

  console.log('[BrowserVault] Password set successfully');
  return { success: true };
});

/**
 * Persists updated settings and restarts the idle watcher.
 * Payload: Partial<UserSettings>
 */
router.on('UPDATE_SETTINGS', async (payload: Partial<UserSettings>) => {
  const current =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;
  const updated: UserSettings = { ...current, ...payload };
  await storage.setItem<UserSettings>(STORAGE_KEYS.SETTINGS, updated);

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
