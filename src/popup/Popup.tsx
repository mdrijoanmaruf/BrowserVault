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
import {
  STORAGE_KEYS,
  DEFAULT_AUTH_STATE,
  DEFAULT_LOCK_STATE,
} from '@/lib/constants';
import { StatusBadge } from './components/StatusBadge';
import { LockButton } from './components/LockButton';
import { QuickMenu } from './components/QuickMenu';
import type { AuthState, LockState } from '@/types';

// ── Lightweight direct-storage helpers (no SW needed) ──────────
function storageGet<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
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

  // Lock/unlock state
  const [isLocking, setIsLocking] = useState(false);
  const [lockError, setLockError] = useState('');

  // ── Load state directly from storage ────────────────────────
  const loadState = useCallback(async () => {
    const auth = (await storageGet<AuthState>(STORAGE_KEYS.AUTH_STATE)) ?? {
      ...DEFAULT_AUTH_STATE,
    };
    const lock = (await storageGet<LockState>(STORAGE_KEYS.LOCK_STATE)) ?? {
      ...DEFAULT_LOCK_STATE,
    };
    setLockState(lock);
    setView(auth.hasPassword ? 'main' : 'setup');
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // ── Lock / Unlock — writes storage + broadcasts to all tabs directly ────
  const broadcastToTabs = async (action: string) => {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (
          tab.id &&
          tab.url &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('chrome-extension://')
        ) {
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
      notifySW('LOCK_BROWSER');
      // Update local state directly so UI responds fast
      const newLock: LockState = {
        ...lockState,
        isLocked: true,
        failedAttemptCount: 0,
      };
      setLockState(newLock);
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
      const newLock: LockState = {
        ...lockState,
        isLocked: false,
        failedAttemptCount: 0,
        cooldownExpiresAt: null,
      };
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
    <div className="min-h-[220px] bg-white text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-3.5">
          <img
            src={chrome.runtime.getURL('icons/icon128.png')}
            alt="BrowserVault Logo"
            className="w-[42px] h-[42px] flex-shrink-0"
          />
          <div>
            <h1 className="text-[17px] font-bold text-slate-900 leading-tight">
              BrowserVault
            </h1>
            <p className="text-[13px] text-slate-400 font-medium mt-0.5">
              Browser Security
            </p>
          </div>
        </div>
        {view === 'main' && <StatusBadge isLocked={isLocked} />}
      </div>

      {/* Body */}
      <div className="flex-1 px-6 py-4 flex flex-col">
        {/* Loading */}
        {view === 'loading' && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-20 bg-slate-100 rounded-3xl" />
            <div className="h-12 bg-slate-50 rounded-2xl" />
          </div>
        )}

        {/* ── Set Password view ── */}
        {view === 'setup' && (
          <div className="flex flex-col gap-3 h-full justify-center mt-4">
            <div className="text-center mb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Welcome to BrowserVault
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 px-2">
                Please complete the setup in the new tab to secure your browser.
              </p>
            </div>

            <button
              onClick={() =>
                chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') })
              }
              className="w-full bg-[#5a8bf7] hover:bg-[#4673d4] text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Start Setup
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        )}

        {/* ── Main view ── */}
        {view === 'main' && (
          <div className="flex flex-col gap-4">
            {/* Lock error */}
            {lockError && (
              <p className="text-red-500 text-xs text-center">{lockError}</p>
            )}

            {/* Lock button area */}
            <LockButton
              isLocked={isLocked}
              isLoading={isLocking}
              onClick={isLocked ? handleUnlock : handleLock}
            />

            {/* Info and Settings */}
            <div className="flex flex-col gap-3 w-full">
              {/* Idle info message */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-[16px] bg-[#f4f7ff] border border-[#e1e9ff]">
                <div className="text-[#5a8bf7] flex-shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <span className="text-[#4b6299] text-[12px] font-medium leading-tight">
                  Idle lock is managed via Settings
                </span>
              </div>

              {/* QuickMenu Settings Card */}
              <QuickMenu />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
