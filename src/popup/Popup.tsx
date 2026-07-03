/**
 * Popup — main toolbar popup (Day 11)
 *
 * Fetches lock & auth state on mount, shows the current status,
 * and provides the primary Lock Browser action and quick navigation.
 */

import { useState, useEffect } from 'react';
import type { LockState, AuthState } from '@/types';
import { StatusBadge } from './components/StatusBadge';
import { LockButton } from './components/LockButton';
import { QuickMenu } from './components/QuickMenu';

interface ExtState {
  lockState: LockState;
  authState: AuthState;
}

export function Popup() {
  const [state, setState] = useState<ExtState | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [error, setError] = useState('');

  // ── Load state from background ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' }) as
          { data?: ExtState } | undefined;
        if (response?.data) setState(response.data);
      } catch {
        setError('Could not connect to BrowserVault service.');
      }
    })();
  }, []);

  // ── Lock handler ────────────────────────────────────────────
  const handleLock = async () => {
    setIsLocking(true);
    setError('');
    try {
      await chrome.runtime.sendMessage({ action: 'LOCK_BROWSER' });
      // Refresh state after locking
      const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' }) as
        { data?: ExtState } | undefined;
      if (response?.data) setState(response.data);
    } catch {
      setError('Failed to lock the browser. Please try again.');
    } finally {
      setIsLocking(false);
    }
  };

  const isLocked = state?.lockState?.isLocked ?? false;

  return (
    <div className="min-h-[220px] bg-slate-50 dark:bg-gradient-to-b dark:from-[#0f0b22] dark:to-[#130d2a] text-slate-900 dark:text-white flex flex-col transition-colors duration-200">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <div className="flex items-center gap-3">
          {/* Shield logo */}
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center shadow shadow-purple-900/60 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6V12C4 16.8 7.6 21.1 12 22.5C16.4 21.1 20 16.8 20 12V6L12 2Z" fill="white" fillOpacity="0.95"/>
              <path d="M9 12.5L11 14.5L15 10.5" stroke="rgba(109,40,217,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-none">BrowserVault</h1>
            <p className="text-[10px] text-slate-500 dark:text-white/35 mt-0.5">Browser security</p>
          </div>
        </div>
        {/* Status badge */}
        {state && <StatusBadge isLocked={isLocked} />}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-5 py-5 flex flex-col gap-4">
        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-700 dark:text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Loading skeleton */}
        {!state && !error && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="h-14 bg-slate-200 dark:bg-white/5 rounded-2xl" />
            <div className="h-8 bg-slate-100 dark:bg-white/[0.03] rounded-xl" />
          </div>
        )}

        {/* Lock button */}
        {state && (
          <LockButton
            isLocked={isLocked}
            isLoading={isLocking}
            onClick={handleLock}
          />
        )}

        {/* Idle info strip */}
        {state && !isLocked && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] transition-colors duration-200">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-400 dark:text-white/25 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-slate-500 dark:text-white/30 text-[11px]">Idle lock is managed via Settings</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-5 pb-5">
        <QuickMenu />
      </div>
    </div>
  );
}
