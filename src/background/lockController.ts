/**
 * Lock Controller — Day 6
 *
 * Core functions for locking/unlocking the browser.
 * Persists lock state to chrome.storage.local and broadcasts
 * overlay messages to all open tabs.
 */

import { storage } from '@/lib/storage';
import { verifyPassword } from '@/lib/crypto';
import { STORAGE_KEYS, DEFAULT_LOCK_STATE } from '@/lib/constants';
import type { LockState } from '@/types';

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
 * Failures on individual tabs are silently swallowed (e.g. restricted pages).
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
// Public API
// ─────────────────────────────────────────────────────────────

export interface UnlockResult {
  success: boolean;
  /** Set when unlocking fails due to wrong password */
  failedAttemptCount?: number;
  /** Set when no password has been configured yet */
  noPasswordSet?: boolean;
  error?: string;
}

/**
 * Locks the browser:
 * 1. Persists isLocked = true in storage
 * 2. Broadcasts SHOW_LOCK_OVERLAY to all open tabs
 */
export async function lockBrowser(): Promise<void> {
  const state = await getLockState();
  state.isLocked = true;
  await saveLockState(state);

  console.log('[BrowserVault] Browser locked — broadcasting overlay');
  await broadcastToAllTabs({ action: 'SHOW_LOCK_OVERLAY' });
}

/**
 * Unlocks the browser:
 * 1. Verifies the supplied password against the stored hash + salt
 * 2. On success: persists isLocked = false, resets failedAttemptCount, broadcasts HIDE_LOCK_OVERLAY
 * 3. On failure: increments failedAttemptCount in storage and returns the updated count
 *
 * @param password - The plain-text password supplied by the user
 */
export async function unlockBrowser(password: string): Promise<UnlockResult> {
  // Load stored credentials
  const storedHash = await storage.getItem<string>('vault_password_hash');
  const storedSalt = await storage.getItem<string>('vault_password_salt');

  if (!storedHash || !storedSalt) {
    // First-time setup — no password configured yet (handled in Day 10 flow)
    return { success: false, noPasswordSet: true };
  }

  const isValid = await verifyPassword(password, storedHash, storedSalt);

  const state = await getLockState();

  if (isValid) {
    state.isLocked = false;
    state.failedAttemptCount = 0;
    state.cooldownExpiresAt = null;
    await saveLockState(state);

    console.log('[BrowserVault] Browser unlocked — removing overlay');
    await broadcastToAllTabs({ action: 'HIDE_LOCK_OVERLAY' });

    return { success: true };
  } else {
    state.failedAttemptCount += 1;
    await saveLockState(state);

    console.warn(
      `[BrowserVault] Unlock failed. Attempt ${state.failedAttemptCount}`
    );
    return { success: false, failedAttemptCount: state.failedAttemptCount };
  }
}

/**
 * Returns the current persisted lock state.
 */
export async function getLockStatus(): Promise<LockState> {
  return getLockState();
}
