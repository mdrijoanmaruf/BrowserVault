

import { storage } from '@/lib/storage';
import { verifyPassword } from '@/lib/crypto';
import { STORAGE_KEYS, DEFAULT_LOCK_STATE } from '@/lib/constants';
import { logActivity } from '@/lib/activityLog';
import type { LockState } from '@/types';

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;


async function getLockState(): Promise<LockState> {
  const state = await storage.getItem<LockState>(STORAGE_KEYS.LOCK_STATE);
  return state ?? { ...DEFAULT_LOCK_STATE };
}

async function saveLockState(state: LockState): Promise<void> {
  await storage.setItem<LockState>(STORAGE_KEYS.LOCK_STATE, state);
}


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


export async function lockBrowser(): Promise<void> {
  const state = await getLockState();
  state.isLocked = true;
  await saveLockState(state);

  await logActivity('LOCK');
  console.log('[BrowserVault] Browser locked — redirecting tabs');

  const LOCK_PAGE_URL = chrome.runtime.getURL('lock.html');
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    const url = tab.url ?? tab.pendingUrl ?? '';
    
    // Don't redirect tabs that are already on the lock page
    if (url.startsWith(LOCK_PAGE_URL)) continue;

    // For all pages, redirect to the lock screen with the original URL saved
    const encodedRedirect = url ? encodeURIComponent(url) : '';
    const redirectUrl = encodedRedirect ? `${LOCK_PAGE_URL}?redirect=${encodedRedirect}` : LOCK_PAGE_URL;
    chrome.tabs.update(tab.id, { url: redirectUrl }).catch(() => {});
  }

  await broadcastToAllTabs({ action: 'SHOW_LOCK_OVERLAY' });
}

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
    console.log('[BrowserVault] Browser unlocked');

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

export async function getLockStatus(): Promise<LockState> {
  return getLockState();
}
