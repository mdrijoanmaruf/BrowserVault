import { MessageRouter } from './messageRouter';
import { lockBrowser, unlockBrowser, getLockStatus } from './lockController';
import { startIdleWatcher, stopIdleWatcher } from './idleWatcher';
import { startDomainWatcher } from './domainWatcher';
import {
  startScheduledLock,
  stopScheduledLock,
  setupSchedulerListener,
} from './scheduler';
import { storage } from '@/lib/storage';
import {
  STORAGE_KEYS,
  DEFAULT_USER_SETTINGS,
  DEFAULT_AUTH_STATE,
  DEFAULT_LOCK_STATE,
  WORKER_ENDPOINT,
  WORKER_SHARED_SECRET,
  OTP_EXPIRY_MINUTES,
} from '@/lib/constants';
import { generateSalt, hashPassword, generateBackupCodes } from '@/lib/crypto';
import { generateOtp } from '@/lib/otp';
import {
  getActivityLog,
  pruneActivityLog,
  logActivity,
} from '@/lib/activityLog';
import type { UserSettings, AuthState, LockState } from '@/types';

const router = new MessageRouter();

chrome.alarms.create('bv-keepalive', { periodInMinutes: 0.4 }); // every ~24s
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'bv-keepalive') {
    // Intentional no-op: just wakes up the service worker
    console.debug('[BrowserVault] keepalive ping');
  }
});

// Port-based message handling for reliable popup↔SW communication
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'bv-popup') return;
  port.onMessage.addListener(async (message) => {
    if (!message?.action) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (router as any).handlers?.get(message.action);
    if (!handler) {
      port.postMessage({
        success: false,
        error: `Unknown action: ${message.action}`,
      });
      return;
    }
    try {
      const data = await handler(message.payload);
      port.postMessage({ success: true, data, _reqId: message._reqId });
    } catch (err: unknown) {
      port.postMessage({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        _reqId: message._reqId,
      });
    }
  });
});

async function initializeState(): Promise<void> {
  const authState = (await storage.getItem<AuthState>(
    STORAGE_KEYS.AUTH_STATE
  )) ?? { ...DEFAULT_AUTH_STATE };

  // Check if this is a fresh browser session
  try {
    const sessionData = await chrome.storage.session.get('session_started');
    if (!sessionData.session_started && authState.hasPassword) {
      console.log('[BrowserVault] New browser session detected. Forcing lock.');
      await lockBrowser();
      await chrome.storage.session.set({ session_started: true });
    }
  } catch (e) {
    console.error('Session storage error:', e);
  }

  const lockState = await getLockStatus();
  console.log('[BrowserVault] Service Worker started. Lock state:', lockState);

  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  startIdleWatcher(settings);
  startDomainWatcher();
  startScheduledLock(settings);
  setupSchedulerListener();

  await pruneActivityLog(settings.logRetentionDays);
}

router.on('GET_STATE', async () => {
  const lockState = await getLockStatus();
  const authState = (await storage.getItem<AuthState>(
    STORAGE_KEYS.AUTH_STATE
  )) ?? { ...DEFAULT_AUTH_STATE };
  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  return { lockState, authState, maxAttempts: settings.maxAttempts, settings };
});

router.on('LOCK_BROWSER', async () => {
  await lockBrowser();
  return { success: true };
});

router.on('UNLOCK_BROWSER', async (payload: { password?: string }) => {
  const password = payload?.password ?? '';
  const settings =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;

  return await unlockBrowser(password, settings.maxAttempts);
});

router.on('SET_PASSWORD', async (payload: { password?: string }) => {
  const password = payload?.password;
  if (!password) {
    return { success: false, error: 'No password provided' };
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);

  await storage.setItem('vault_password_hash', hash);
  await storage.setItem('vault_password_salt', salt);

  const authState: AuthState = (await storage.getItem<AuthState>(
    STORAGE_KEYS.AUTH_STATE
  )) ?? { ...DEFAULT_AUTH_STATE };

  let backupCodes: string[] | undefined;

  if (!authState.hasPassword) {
    // First time setup: generate backup codes
    backupCodes = generateBackupCodes();

    // Hash them for storage
    const backupHashes = await Promise.all(
      backupCodes.map((code) => hashPassword(code, salt)) // Re-using same salt for simplicity, or we can generate a new one
    );

    await storage.setItem('vault_backup_codes', backupHashes);
    authState.hasBackupCodes = true;
  }

  authState.hasPassword = true;
  await storage.setItem<AuthState>(STORAGE_KEYS.AUTH_STATE, authState);

  console.log('[BrowserVault] Password set successfully');
  return { success: true, backupCodes };
});

router.on('UPDATE_SETTINGS', async (payload: Partial<UserSettings>) => {
  const current =
    (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
    DEFAULT_USER_SETTINGS;
  const updated: UserSettings = { ...current, ...payload };
  await storage.setItem<UserSettings>(STORAGE_KEYS.SETTINGS, updated);

  stopIdleWatcher();
  stopScheduledLock();
  startIdleWatcher(updated);
  startScheduledLock(updated);

  console.log('[BrowserVault] Settings updated:', updated);
  return { success: true, settings: updated };
});

router.on('FACTORY_RESET', async () => {
  console.log('[BrowserVault] Executing FACTORY_RESET');
  try {
    stopIdleWatcher();
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();

    // Broadcast unlock to all tabs in case lock screen is visible
    await chrome.tabs.query({}).then((tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
          chrome.tabs
            .sendMessage(tab.id, { action: 'HIDE_LOCK_OVERLAY' })
            .catch(() => {});
        }
      });
    });

    return { success: true };
  } catch (err) {
    console.error('Factory reset failed:', err);
    return { success: false, error: 'Failed to reset extension' };
  }
});

router.on('REQUEST_OTP', async (payload: { email?: string }) => {
  const authState = await storage.getItem<AuthState>(STORAGE_KEYS.AUTH_STATE);
  const targetEmail = payload?.email || authState?.recoveryEmail;
  if (!targetEmail) {
    return {
      success: false,
      error:
        'No email provided or configured. Please set a recovery email in Settings first.',
    };
  }

  // Generate cryptographically secure 6-digit OTP using the dedicated utility
  const otp = generateOtp();
  const salt = generateSalt();
  const hash = await hashPassword(otp, salt);

  // Store hashed OTP + expiry (never store plain OTP)
  await storage.setItem('vault_otp_hash', hash);
  await storage.setItem('vault_otp_salt', salt);
  await storage.setItem(
    'vault_otp_expires',
    Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  );

  try {
    const res = await fetch(WORKER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WORKER_SHARED_SECRET}`,
      },
      body: JSON.stringify({ email: targetEmail, otp }),
    });

    if (!res.ok) {
      let errorMsg = 'Failed to send OTP email. Please try again.';
      let retryAfterSec: number | undefined;
      try {
        const errJson = (await res.json()) as {
          error?: string;
          retryAfterSec?: number;
        };
        if (errJson.error) errorMsg = errJson.error;
        if (errJson.retryAfterSec) retryAfterSec = errJson.retryAfterSec;
      } catch {
        /* ignore parse errors */
      }
      console.error(
        '[BrowserVault] OTP dispatch failed:',
        res.status,
        errorMsg
      );
      return { success: false, error: errorMsg, retryAfterSec };
    }

    console.log(`[BrowserVault] OTP dispatched to ${targetEmail}`);
    return { success: true, email: targetEmail };
  } catch (err) {
    console.error('[BrowserVault] Network error requesting OTP:', err);
    return {
      success: false,
      error: 'Network error. Make sure the OTP service is running.',
    };
  }
});

router.on(
  'VERIFY_OTP',
  async (payload: {
    otp?: string;
    purpose?: 'unlock' | 'verify' | 'forgot';
  }) => {
    const otp = payload?.otp;
    if (!otp) return { success: false, error: 'No OTP provided' };

    const expiresAt = await storage.getItem<number>('vault_otp_expires');
    if (!expiresAt || Date.now() > expiresAt) {
      return {
        success: false,
        error: 'OTP has expired. Please request a new code.',
      };
    }

    const storedHash = await storage.getItem<string>('vault_otp_hash');
    const storedSalt = await storage.getItem<string>('vault_otp_salt');
    if (!storedHash || !storedSalt) {
      return { success: false, error: 'No OTP has been requested.' };
    }

    const isValid = await hashPassword(otp, storedSalt).then(
      (h) => h === storedHash
    );
    if (isValid) {
      // Clear OTP from storage after successful verification
      await storage.removeItem('vault_otp_hash');
      await storage.removeItem('vault_otp_salt');
      await storage.removeItem('vault_otp_expires');

      // Only auto-unlock if purpose is 'unlock' (not 'verify' or 'forgot')
      if (payload.purpose !== 'verify' && payload.purpose !== 'forgot') {
        const state = (await storage.getItem<LockState>(
          STORAGE_KEYS.LOCK_STATE
        )) ?? { ...DEFAULT_LOCK_STATE };
        state.isLocked = false;
        state.failedAttemptCount = 0;
        state.cooldownExpiresAt = null;
        await storage.setItem(STORAGE_KEYS.LOCK_STATE, state);

        await logActivity('UNLOCK', 'Unlocked via OTP');
        await chrome.tabs.query({}).then((tabs) => {
          tabs.forEach((tab) => {
            if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
              chrome.tabs
                .sendMessage(tab.id, { action: 'HIDE_LOCK_OVERLAY' })
                .catch(() => {});
            }
          });
        });
      }

      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid OTP code. Please check and try again.',
    };
  }
);

router.on('UNLOCK_WITH_BIOMETRICS', async () => {
  const state = (await storage.getItem<LockState>(STORAGE_KEYS.LOCK_STATE)) ?? {
    ...DEFAULT_LOCK_STATE,
  };
  state.isLocked = false;
  state.failedAttemptCount = 0;
  state.cooldownExpiresAt = null;
  await storage.setItem(STORAGE_KEYS.LOCK_STATE, state);

  await logActivity('UNLOCK', 'Unlocked via Biometrics (WebAuthn)');
  await chrome.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        chrome.tabs
          .sendMessage(tab.id, { action: 'HIDE_LOCK_OVERLAY' })
          .catch(() => {});
      }
    });
  });

  return { success: true };
});

/** Returns the full activity log */
router.on('GET_ACTIVITY_LOG', async () => {
  return await getActivityLog();
});

router.listen();
initializeState();

/** Returns true if the browser is currently locked */
async function isCurrentlyLocked(): Promise<boolean> {
  const state = await storage.getItem<{ isLocked?: boolean }>(
    STORAGE_KEYS.LOCK_STATE
  );
  return state?.isLocked === true;
}

chrome.runtime.onStartup.addListener(async () => {
  console.log('[BrowserVault] onStartup fired');
  if (!(await isCurrentlyLocked())) return;
  await lockBrowser();
});

const LOCK_PAGE_URL = chrome.runtime.getURL('lock.html');

chrome.windows.onCreated.addListener(async (window) => {
  if (!(await isCurrentlyLocked())) return;

  // Short delay to allow tabs to be populated in the new window
  setTimeout(async () => {
    try {
      const tabs = await chrome.tabs.query({ windowId: window.id });
      for (const tab of tabs) {
        if (!tab.id) continue;
        const url = tab.url ?? tab.pendingUrl ?? '';
        if (url.startsWith(LOCK_PAGE_URL)) continue;

        const encodedRedirect = url ? encodeURIComponent(url) : '';
        const redirectUrl = encodedRedirect
          ? `${LOCK_PAGE_URL}?redirect=${encodedRedirect}`
          : LOCK_PAGE_URL;
        chrome.tabs.update(tab.id, { url: redirectUrl }).catch(() => {});
      }
    } catch {
      // Ignore errors if window closes quickly
    }
  }, 100);
});

chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tab.id) return;
  if (!(await isCurrentlyLocked())) return;

  const url = tab.url ?? tab.pendingUrl ?? '';
  if (url.startsWith(LOCK_PAGE_URL)) return;

  const encodedRedirect = url ? encodeURIComponent(url) : '';
  const redirectUrl = encodedRedirect
    ? `${LOCK_PAGE_URL}?redirect=${encodedRedirect}`
    : LOCK_PAGE_URL;
  chrome.tabs.update(tab.id, { url: redirectUrl }).catch(() => {});
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;
  const url = changeInfo.url ?? tab.url ?? '';

  if (
    !url ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome://')
  )
    return;
  if (url.startsWith(LOCK_PAGE_URL)) return;

  if (!(await isCurrentlyLocked())) return;

  const encodedRedirect = url ? encodeURIComponent(url) : '';
  const redirectUrl = encodedRedirect
    ? `${LOCK_PAGE_URL}?redirect=${encodedRedirect}`
    : LOCK_PAGE_URL;
  chrome.tabs.update(tabId, { url: redirectUrl }).catch(() => {});
});

chrome.windows.onRemoved.addListener(async () => {
  try {
    const windows = await chrome.windows.getAll({
      windowTypes: ['normal', 'popup'],
    });
    if (windows.length === 0) {
      console.log('[BrowserVault] Last window closed. Forcing lock.');
      const authState = await storage.getItem<AuthState>(
        STORAGE_KEYS.AUTH_STATE
      );
      if (authState?.hasPassword) {
        await lockBrowser();
      }
    }
  } catch (e) {
    console.error('Error on windows.onRemoved:', e);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'panic-lock') {
    console.log('[BrowserVault] Panic lock shortcut triggered');
    lockBrowser();
  }
});
