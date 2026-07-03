/**
 * Popup — main toolbar popup
 *
 * Reads state DIRECTLY from chrome.storage.local — zero dependency on
 * the background service worker for initial load or password setup.
 * This completely eliminates "Receiving end does not exist" errors.
 *
 * Flow:
 *  1. On mount: read hasPassword + isLocked from chrome.storage.local
 *  2. If no password → show Set Password form
 *  3. If password set → show lock/unlock controls
 *  4. Lock / Unlock use sendMessage to wake the SW (with graceful fallback)
 */

import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS, DEFAULT_AUTH_STATE, DEFAULT_LOCK_STATE } from '@/lib/constants';
import { generateSalt, hashPassword } from '@/lib/crypto';
import { StatusBadge } from './components/StatusBadge';
import { LockButton } from './components/LockButton';
import { QuickMenu } from './components/QuickMenu';
import type { AuthState, LockState } from '@/types';

// ── Lightweight direct-storage helpers (no SW needed) ──────────
function storageGet<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) { resolve(null); return; }
      resolve(result[key] !== undefined ? (result[key] as T) : null);
    });
  });
}

function storageSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

/** Try to wake the service worker via sendMessage, but don't block on it. */
function notifySW(action: string, payload?: unknown): void {
  chrome.runtime.sendMessage({ action, payload }, () => {
    // Intentionally consume lastError — SW may not be alive
    void chrome.runtime.lastError;
  });
}

// ─────────────────────────────────────────────────────────────

type View = 'loading' | 'setup' | 'main';

export function Popup() {
  const [view, setView] = useState<View>('loading');
  const [lockState, setLockState] = useState<LockState>(DEFAULT_LOCK_STATE);

  // Setup-password form state
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Lock/unlock state
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState('');

  // ── Load state directly from storage ────────────────────────
  const loadState = useCallback(async () => {
    const auth = (await storageGet<AuthState>(STORAGE_KEYS.AUTH_STATE)) ?? { ...DEFAULT_AUTH_STATE };
    const lock = (await storageGet<LockState>(STORAGE_KEYS.LOCK_STATE)) ?? { ...DEFAULT_LOCK_STATE };
    setLockState(lock);
    setView(auth.hasPassword ? 'main' : 'setup');
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  // ── Set Password (all in popup, no SW) ──────────────────────
  const handleSetPassword = async () => {
    setSetupError('');
    if (password.length < 8) {
      setSetupError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setSetupError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      await storageSet('vault_password_hash', hash);
      await storageSet('vault_password_salt', salt);

      const newAuth: AuthState = { ...DEFAULT_AUTH_STATE, hasPassword: true };
      await storageSet(STORAGE_KEYS.AUTH_STATE, newAuth);

      // Also initialise lock state as unlocked
      const newLock: LockState = { ...DEFAULT_LOCK_STATE, isLocked: false };
      await storageSet(STORAGE_KEYS.LOCK_STATE, newLock);

      // Notify SW to reload its in-memory state (non-blocking)
      notifySW('GET_STATE');
      setLockState(newLock);
      setView('main');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Failed to save password.');
    } finally {
      setSaving(false);
    }
  };

  // ── Lock / Unlock — writes storage + broadcasts to all tabs directly ────
  const broadcastToTabs = async (action: string) => {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
        }
      }
    } catch {
      // Non-critical — overlay state is already saved to storage
    }
  };

  const handleLock = async () => {
    setIsLocking(true);
    setLockError('');
    try {
      const newLock: LockState = { ...lockState, isLocked: true, failedAttemptCount: 0 };
      await storageSet(STORAGE_KEYS.LOCK_STATE, newLock);
      setLockState(newLock);
      // Broadcast to all open tabs so the overlay appears immediately
      await broadcastToTabs('SHOW_LOCK_OVERLAY');
    } catch {
      setLockError('Failed to lock. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlock = async () => {
    setIsLocking(true);
    setLockError('');
    try {
      const newLock: LockState = { ...lockState, isLocked: false, failedAttemptCount: 0, cooldownExpiresAt: null };
      await storageSet(STORAGE_KEYS.LOCK_STATE, newLock);
      setLockState(newLock);
      await broadcastToTabs('HIDE_LOCK_OVERLAY');
    } catch {
      setLockError('Failed to unlock. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const isLocked = lockState.isLocked;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-[220px] bg-slate-50 dark:bg-gradient-to-b dark:from-[#0f0b22] dark:to-[#130d2a] text-slate-900 dark:text-white flex flex-col transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img
            src={chrome.runtime.getURL('icons/icon128.png')}
            alt="BrowserVault Logo"
            className="w-8 h-8 flex-shrink-0 rounded-lg shadow shadow-purple-900/60"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-none">BrowserVault</h1>
            <p className="text-[10px] text-slate-500 dark:text-white/35 mt-0.5">Browser security</p>
          </div>
        </div>
        {view === 'main' && <StatusBadge isLocked={isLocked} />}
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-5 flex flex-col gap-4">

        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-14 bg-slate-200 dark:bg-white/5 rounded-2xl" />
            <div className="h-8 bg-slate-100 dark:bg-white/[0.03] rounded-xl" />
          </div>
        )}

        {/* ── Set Password view ── */}
        {view === 'setup' && (
          <div className="flex flex-col gap-3">
            <div className="text-center mb-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-violet-300">Welcome to BrowserVault</h2>
              <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1">Set a master password to secure your browser.</p>
            </div>

            {/* Password input */}
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSetupError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                placeholder="New password (min. 8 characters)"
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30 hover:text-violet-500 transition-colors"
              >
                {showPw ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            {/* Confirm input */}
            <input
              type={showPw ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setSetupError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              placeholder="Confirm password"
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/25 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
            />

            {/* Error */}
            {setupError && (
              <p className="text-red-500 dark:text-red-400 text-[11px] text-center">{setupError}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSetPassword}
              disabled={saving || !password || !confirm}
              className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
                  Saving…
                </>
              ) : 'Set Password & Continue'}
            </button>
          </div>
        )}

        {/* ── Main view ── */}
        {view === 'main' && (
          <>
            {/* Lock error */}
            {lockError && (
              <p className="text-red-500 dark:text-red-400 text-xs text-center">{lockError}</p>
            )}

            {/* Lock button */}
            <LockButton
              isLocked={isLocked}
              isLoading={isLocking}
              onClick={isLocked ? handleUnlock : handleLock}
            />

            {/* Idle info strip */}
            {!isLocked && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-400 dark:text-white/25 flex-shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span className="text-slate-500 dark:text-white/30 text-[11px]">Idle lock is managed via Settings</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5">
        <QuickMenu />
      </div>
    </div>
  );
}
