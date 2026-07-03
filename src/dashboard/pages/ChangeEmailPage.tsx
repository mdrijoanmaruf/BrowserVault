/**
 * ChangeEmailPage — Day 15 (Nav placeholder & basic form)
 */

import { useState, useEffect } from 'react';
import { logActivity } from '@/lib/activityLog';
import type { AuthState } from '@/types';

export function ChangeEmailPage() {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('vault_auth_state').then(res => {
      const state = res.vault_auth_state as AuthState | undefined;
      if (state?.recoveryEmail) {
        setCurrentEmail(state.recoveryEmail);
      }
    });
  }, []);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setStatus({ type: 'error', msg: 'Please enter your password.' }); return; }
    if (!email.includes('@')) { setStatus({ type: 'error', msg: 'Please enter a valid email address.' }); return; }
    
    setIsLoading(true);
    setStatus(null);
    try {
      // 1. Verify Password
      const unlockResp = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password },
      }) as { data?: { success?: boolean; cooldownActive?: boolean } } | undefined;

      if (!unlockResp?.data?.success) {
        if (unlockResp?.data?.cooldownActive) {
          setStatus({ type: 'error', msg: 'Too many attempts. Cooldown active.' });
        } else {
          setStatus({ type: 'error', msg: 'Incorrect password.' });
        }
        setIsLoading(false);
        return;
      }

      // 2. Request OTP to the new email
      const otpResp = await chrome.runtime.sendMessage({
        action: 'REQUEST_OTP',
        payload: { email },
      }) as { success?: boolean; error?: string } | undefined;

      if (otpResp?.success) {
        setStep('verify');
        setStatus({ type: 'success', msg: 'Verification code sent! Please check your inbox.' });
      } else {
        setStatus({ type: 'error', msg: otpResp?.error || 'Failed to send verification code.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) { setStatus({ type: 'error', msg: 'Please enter the verification code.' }); return; }

    setIsLoading(true);
    setStatus(null);
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'VERIFY_OTP',
        payload: { otp, purpose: 'verify' }
      }) as { success?: boolean; error?: string } | undefined;

      if (resp?.success) {
        // Save new email to auth state
        const authState = await chrome.storage.local.get('vault_auth_state').then(r => (r.vault_auth_state || {}) as AuthState);
        authState.recoveryEmail = email;
        await chrome.storage.local.set({ vault_auth_state: authState });

        setStatus({ type: 'success', msg: 'Recovery email updated successfully!' });
        setCurrentEmail(email);
        setStep('request');
        setPassword('');
        setEmail('');
        setOtp('');
        await logActivity('EMAIL_CHANGE', 'Recovery email updated');
      } else {
        setStatus({ type: 'error', msg: resp?.error || 'Invalid verification code.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden max-w-xl transition-colors duration-200">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recovery Email</h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">Set an email address to recover your account if you forget your password.</p>
        {currentEmail && (
          <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 font-medium">
            Current: {currentEmail}
          </p>
        )}
      </div>
      
      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="pwd-input">
              Current Password
            </label>
            <input
              id="pwd-input"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setStatus(null); }}
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="email-input">
              New Email Address
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
              placeholder="you@example.com"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
              {status.msg}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="otp-input">
              Verification Code
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value); setStatus(null); }}
              placeholder="000000"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-2xl tracking-widest text-center rounded-xl px-4 py-4 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors font-mono"
              autoFocus
            />
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
              {status.msg}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep('request')}
              className="flex-1 bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white/90 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Verify & Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
