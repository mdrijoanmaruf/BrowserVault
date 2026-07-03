/**
 * Lock Controller — Days 6 + 12 + 13
 *
 * Core functions for locking/unlocking the browser.
 * Persists LockState to chrome.storage.local and broadcasts
 * overlay messages to all open tabs.
 *
 * Day 12 additions:
 *  - unlockBrowser() accepts maxAttempts from settings
 *  - Returns remainingAttempts in UnlockResult
 *
 * Day 13 additions:
 *  - When failedAttemptCount reaches maxAttempts, sets cooldownExpiresAt
 *  - unlockBrowser() checks for active cooldown before verifying password
 *  - Logs FAILED_ATTEMPT and LOCK events to the activity log
 */

import { storage } from '@/lib/storage';
import { verifyPassword } from '@/lib/crypto';
import { STORAGE_KEYS, DEFAULT_LOCK_STATE } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import type { LockState } from '@/types';

/** Default cooldown duration when max attempts are exhausted (5 minutes) */
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function getLockState(): Promise<LockState> {
  const state = await storage.getItem<LockState>(STORAGE_KEYS.LOCK_STATE);
  return state ?? { ...DEFAULT_LOCK_STATE };
}

async function saveLockState(state: LockState): Promise<void> {
  await storage.setItem<LockState>(STORAGE_KEYS.LOCK_STATE, state);
}

/**
 * Broadcasts a message to every non-chrome:// tab.
 * Failures on individual tabs are silently swallowed.
 */
async function broadcastToAllTabs(message: Record<string, unknown>): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const sends = tabs
    .filter((tab) => tab.id !== undefined && tab.url && !tab.url.startsWith('chrome://'))
    .map((tab) =>
      chrome.tabs.sendMessage(tab.id!, message).catch(() => {
        // Some tabs may not have the content script — ignore silently
      })
    );
  await Promise.allSettled(sends);
}

// ─────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────

export interface UnlockResult {
  success: boolean;
  /** Remaining attempts before cooldown kicks in */
  remainingAttempts?: number;
  /** Current failed attempt count */
  failedAttemptCount?: number;
  /** True when a cooldown is active — provide cooldownExpiresAt for the countdown */
  cooldownActive?: boolean;
  cooldownExpiresAt?: number;
  /** True when no password has been configured yet */
  noPasswordSet?: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Locks the browser:
 * 1. Persists isLocked = true
 * 2. Minimizes all existing windows and creates a fullscreen lock window
 * 3. Broadcasts SHOW_LOCK_OVERLAY to all tabs as backup
 * 4. Logs LOCK event to the activity log
 */
export async function lockBrowser(): Promise<void> {
  const state = await getLockState();
  state.isLocked = true;
  await saveLockState(state);

  await logActivity('LOCK');
  console.log('[BrowserVault] Browser locked — spawning modal window');

  // Minimize all existing windows and record their original state
  const windows = await chrome.windows.getAll();
  const restoredStates: Record<number, string> = {};
  for (const win of windows) {
    if (win.id && win.state && win.state !== 'minimized' && win.type !== 'devtools') {
      restoredStates[win.id] = win.state;
      try {
        await chrome.windows.update(win.id, { state: 'minimized' });
      } catch (e) {}
    }
  }

  await chrome.storage.session.set({ vault_restored_states: restoredStates });

  // Check if lock window already exists
  const sessionData = await chrome.storage.session.get('vault_lock_window_id');
  if (sessionData.vault_lock_window_id) {
    const lockWindowId = sessionData.vault_lock_window_id as number;
    try {
      await chrome.windows.update(lockWindowId, { focused: true });
    } catch (e) {
      // Window doesn't exist anymore, we will recreate
      await createLockWindow();
    }
  } else {
    await createLockWindow();
  }

  await broadcastToAllTabs({ action: 'SHOW_LOCK_OVERLAY' });
}

async function createLockWindow() {
  let lockWin: chrome.windows.Window | undefined;
  try {
    lockWin = await chrome.windows.create({
      url: chrome.runtime.getURL('lock.html'),
      type: 'popup',
      state: 'fullscreen',
      focused: true,
    });
  } catch (e) {
    console.warn('[BrowserVault] Fullscreen popup failed, falling back to maximized normal window', e);
    try {
      lockWin = await chrome.windows.create({
        url: chrome.runtime.getURL('lock.html'),
        type: 'normal',
        state: 'maximized',
        focused: true,
      });
    } catch (e2) {
      console.error('[BrowserVault] Lock window creation failed entirely', e2);
    }
  }

  if (lockWin?.id) {
    await chrome.storage.session.set({ vault_lock_window_id: lockWin.id });
  }
}

/**
 * Attempts to unlock the browser:
 * 1. Rejects immediately if a cooldown is still active
 * 2. Verifies the password
 * 3. On success → resets state, closes modal, restores windows, logs UNLOCK
 * 4. On failure → increments failedAttemptCount
 *    - If count reaches maxAttempts → sets cooldownExpiresAt, logs LOCKOUT
 *
 * @param password    Plain-text password from the user
 * @param maxAttempts Maximum allowed wrong attempts before cooldown (from settings)
 * @param cooldownMs  Cooldown duration in ms (defaults to 5 minutes)
 */
export async function unlockBrowser(
  password: string,
  maxAttempts: number = 5,
  cooldownMs: number = DEFAULT_COOLDOWN_MS
): Promise<UnlockResult> {
  const storedHash = await storage.getItem<string>('vault_password_hash');
  const storedSalt = await storage.getItem<string>('vault_password_salt');

  if (!storedHash || !storedSalt) {
    return { success: false, noPasswordSet: true };
  }

  const state = await getLockState();

  // ── Cooldown check (Day 13) ──────────────────────────────
  if (state.cooldownExpiresAt !== null && Date.now() < state.cooldownExpiresAt) {
    return {
      success: false,
      cooldownActive: true,
      cooldownExpiresAt: state.cooldownExpiresAt,
    };
  }

  // If cooldown has expired, clear it
  if (state.cooldownExpiresAt !== null && Date.now() >= state.cooldownExpiresAt) {
    state.cooldownExpiresAt = null;
    state.failedAttemptCount = 0;
    await saveLockState(state);
  }

  // ── Password / PIN / Backup Codes verification ──────────────────────────────
  let isValid = await verifyPassword(password, storedHash, storedSalt);

  if (!isValid) {
    const pinHash = await storage.getItem<string>('vault_pin_hash');
    const pinSalt = await storage.getItem<string>('vault_pin_salt');
    if (pinHash && pinSalt) {
      isValid = await verifyPassword(password, pinHash, pinSalt);
    }
  }

  if (!isValid) {
    const backupCodesHashes = await storage.getItem<string[]>('vault_backup_codes');
    if (backupCodesHashes && backupCodesHashes.length > 0) {
      for (let i = 0; i < backupCodesHashes.length; i++) {
        if (await verifyPassword(password, backupCodesHashes[i], storedSalt)) {
          isValid = true;
          // Remove used backup code
          backupCodesHashes.splice(i, 1);
          await storage.setItem('vault_backup_codes', backupCodesHashes);
          await logActivity('SETTINGS_CHANGE', 'Backup code used for unlock');
          break;
        }
      }
    }
  }

  if (isValid) {
    state.isLocked = false;
    state.failedAttemptCount = 0;
    state.cooldownExpiresAt = null;
    await saveLockState(state);

    await logActivity('UNLOCK');
    console.log('[BrowserVault] Browser unlocked — removing modal');

    // Remove the lock window
    const sessionData = await chrome.storage.session.get(['vault_lock_window_id', 'vault_restored_states']);
    if (sessionData.vault_lock_window_id) {
      const lockWindowId = sessionData.vault_lock_window_id as number;
      try {
        await chrome.windows.remove(lockWindowId);
      } catch (e) {}
    }

    // Restore minimized windows
    if (sessionData.vault_restored_states) {
      for (const [idStr, windowState] of Object.entries(sessionData.vault_restored_states)) {
        try {
          const id = parseInt(idStr, 10);
          await chrome.windows.update(id, { state: windowState as any });
        } catch (e) {}
      }
    }

    await chrome.storage.session.remove(['vault_lock_window_id', 'vault_restored_states']);
    await broadcastToAllTabs({ action: 'HIDE_LOCK_OVERLAY' });

    return { success: true };
  }

  // ── Failed attempt ───────────────────────────────────────
  state.failedAttemptCount += 1;
  await logActivity('FAILED_ATTEMPT', `Attempt ${state.failedAttemptCount} of ${maxAttempts}`);

  if (state.failedAttemptCount >= maxAttempts) {
    // Trigger cooldown (Day 13)
    state.cooldownExpiresAt = Date.now() + cooldownMs;
    await saveLockState(state);

    await logActivity('SETTINGS_CHANGE', `Cooldown triggered after ${maxAttempts} failed attempts`);
    console.warn(`[BrowserVault] Max attempts reached — cooldown until ${new Date(state.cooldownExpiresAt).toISOString()}`);

    return {
      success: false,
      cooldownActive: true,
      cooldownExpiresAt: state.cooldownExpiresAt,
      failedAttemptCount: state.failedAttemptCount,
    };
  }

  await saveLockState(state);

  const remaining = maxAttempts - state.failedAttemptCount;
  console.warn(`[BrowserVault] Unlock failed. Attempt ${state.failedAttemptCount}. ${remaining} remaining.`);

  return {
    success: false,
    failedAttemptCount: state.failedAttemptCount,
    remainingAttempts: remaining,
  };
}

/**
 * Returns the current persisted lock state.
 */
export async function getLockStatus(): Promise<LockState> {
  return getLockState();
}
