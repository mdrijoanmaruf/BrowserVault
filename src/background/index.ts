/**
 * Service Worker Entry Point — background/index.ts
 *
 * Initialises the message router, lock state, and idle watcher on startup.
 * Routes: GET_STATE, LOCK_BROWSER, UNLOCK_BROWSER, SET_PASSWORD,
 *         UPDATE_SETTINGS, GET_ACTIVITY_LOG
 */

import { MessageRouter } from './messageRouter';
import { lockBrowser, unlockBrowser, getLockStatus } from './lockController';
import { startIdleWatcher, stopIdleWatcher } from './idleWatcher';
import { storage } from '@/lib/storage';
import { STORAGE_KEYS, DEFAULT_USER_SETTINGS, DEFAULT_AUTH_STATE, DEFAULT_LOCK_STATE } from '@/lib/constants';
import { generateSalt, hashPassword, generateBackupCodes } from '@/lib/crypto';
import { getActivityLog, pruneActivityLog, logActivity } from '@/lib/activityLog';
import type { UserSettings, AuthState, LockState } from '@/types';

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
  await pruneActivityLog(settings.logRetentionDays);
}

// ─────────────────────────────────────────────────────────────
// Message Routes
// ─────────────────────────────────────────────────────────────

/** Returns LockState, AuthState, maxAttempts setting, and full settings */
router.on('GET_STATE', async () => {
  const lockState = await getLockStatus();
  const authState =
    (await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE)) ??
    { ...DEFAULT_AUTH_STATE };
  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  return { lockState, authState, maxAttempts: settings.maxAttempts, settings };
});

/** Locks the browser and broadcasts the overlay to all tabs */
router.on('LOCK_BROWSER', async () => {
  await lockBrowser();
  return { success: true };
});

/**
 * Unlocks the browser after verifying the provided password.
 * Enforces maxAttempts limit and cooldown from settings.
 * Payload: { password: string }
 */
router.on('UNLOCK_BROWSER', async (payload: { password?: string }) => {
  const password = payload?.password ?? '';
  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  return await unlockBrowser(password, settings.maxAttempts);
});

/**
 * Stores a new password. If it is the first time, generates backup codes.
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

  const authState: AuthState =
    (await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE)) ??
    { ...DEFAULT_AUTH_STATE };
    
  let backupCodes: string[] | undefined;
  
  if (!authState.hasPassword) {
    // First time setup: generate backup codes
    backupCodes = generateBackupCodes();
    
    // Hash them for storage
    const backupHashes = await Promise.all(
      backupCodes.map(code => hashPassword(code, salt)) // Re-using same salt for simplicity, or we can generate a new one
    );
    
    await storage.setItem('vault_backup_codes', backupHashes);
    authState.hasBackupCodes = true;
  }

  authState.hasPassword = true;
  await storage.setItem<AuthState>(STORAGE_KEYS.AUTH_STATE, authState);

  console.log('[BrowserVault] Password set successfully');
  return { success: true, backupCodes };
});

/**
 * Stores a new PIN.
 * Payload: { pin: string }
 */
router.on('SET_PIN', async (payload: { pin?: string }) => {
  const pin = payload?.pin;
  if (!pin) {
    return { success: false, error: 'No PIN provided' };
  }

  const salt = generateSalt();
  const hash = await hashPassword(pin, salt); // We can reuse hashPassword since PBKDF2 is fine for PINs if salted well

  await storage.setItem('vault_pin_hash', hash);
  await storage.setItem('vault_pin_salt', salt);

  const authState: AuthState =
    (await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE)) ??
    { ...DEFAULT_AUTH_STATE };
  
  authState.hasPin = true;
  await storage.setItem<AuthState>(STORAGE_KEYS.AUTH_STATE, authState);

  console.log('[BrowserVault] PIN set successfully');
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

/**
 * Requests an OTP to be sent to an email.
 * If payload.email is provided, sends to that email (for verification).
 * Otherwise sends to the stored recoveryEmail (for password reset).
 */
router.on('REQUEST_OTP', async (payload: { email?: string }) => {
  const authState = await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE);
  const targetEmail = payload?.email || authState?.recoveryEmail;
  if (!targetEmail) {
    return { success: false, error: 'No email provided or configured.' };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const salt = generateSalt();
  const hash = await hashPassword(otp, salt);
  
  await storage.setItem('vault_otp_hash', hash);
  await storage.setItem('vault_otp_salt', salt);
  await storage.setItem('vault_otp_expires', Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    const res = await fetch('https://browservault-otp-service.your-domain.workers.dev/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer change-me' // Replace with actual shared secret
      },
      body: JSON.stringify({ email: targetEmail, otp })
    });

    if (!res.ok) {
      console.error('Failed to dispatch OTP', await res.text());
      return { success: false, error: 'Failed to dispatch OTP.' };
    }

    return { success: true, email: targetEmail };
  } catch (err) {
    console.error('Error requesting OTP:', err);
    return { success: false, error: 'Network error while requesting OTP.' };
  }
});

/**
 * Verifies an OTP. By default, it unlocks the browser.
 * If payload.purpose === 'verify', it only returns success/fail without unlocking.
 */
router.on('VERIFY_OTP', async (payload: { otp?: string; purpose?: 'unlock' | 'verify' }) => {
  const otp = payload?.otp;
  if (!otp) return { success: false, error: 'No OTP provided' };

  const expiresAt = await storage.getItem<number>('vault_otp_expires');
  if (!expiresAt || Date.now() > expiresAt) {
    return { success: false, error: 'OTP expired.' };
  }

  const storedHash = await storage.getItem<string>('vault_otp_hash');
  const storedSalt = await storage.getItem<string>('vault_otp_salt');
  if (!storedHash || !storedSalt) {
    return { success: false, error: 'No OTP requested.' };
  }

  // Use the crypto utility verifyPassword which just hashes the input and checks it against the stored hash
  const isValid = await hashPassword(otp, storedSalt).then(h => h === storedHash);
  if (isValid) {
    // Clear OTP
    await storage.removeItem('vault_otp_hash');
    await storage.removeItem('vault_otp_salt');
    await storage.removeItem('vault_otp_expires');

    if (payload.purpose !== 'verify') {
      // Unlock browser
      const state = (await storage.getItem<LockState>(STORAGE_KEYS.LOCK_STATE)) ?? { ...DEFAULT_LOCK_STATE };
      state.isLocked = false;
      state.failedAttemptCount = 0;
      state.cooldownExpiresAt = null;
      await storage.setItem(STORAGE_KEYS.LOCK_STATE, state);

      await logActivity('UNLOCK', 'Unlocked via OTP');
      await chrome.tabs.query({}).then(tabs => {
        tabs.forEach(tab => {
          if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
            chrome.tabs.sendMessage(tab.id, { action: 'HIDE_LOCK_OVERLAY' }).catch(() => {});
          }
        });
      });
    }

    return { success: true };
  }

  return { success: false, error: 'Invalid OTP.' };
});

/**
 * Unlocks the browser directly if local biometrics verified successfully.
 * The WebAuthn verification happens in the UI/Content script where navigator.credentials is available.
 */
router.on('UNLOCK_WITH_BIOMETRICS', async () => {
  const state = (await storage.getItem<LockState>(STORAGE_KEYS.LOCK_STATE)) ?? { ...DEFAULT_LOCK_STATE };
  state.isLocked = false;
  state.failedAttemptCount = 0;
  state.cooldownExpiresAt = null;
  await storage.setItem(STORAGE_KEYS.LOCK_STATE, state);

  await logActivity('UNLOCK', 'Unlocked via Biometrics (WebAuthn)');
  await chrome.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(tab.id, { action: 'HIDE_LOCK_OVERLAY' }).catch(() => {});
      }
    });
  });

  return { success: true };
});

/** Returns the full activity log */
router.on('GET_ACTIVITY_LOG', async () => {
  return await getActivityLog();
});

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

router.listen();
initializeState();
