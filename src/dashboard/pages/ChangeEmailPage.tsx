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
  const [sentToEmail, setSentToEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    chrome.storage.local.get('vault_auth_state').then(res => {
      const state = res.vault_auth_state as AuthState | undefined;
      if (state?.recoveryEmail) {
        setCurrentEmail(state.recoveryEmail);
      }
    });
  }, []);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  function maskEmail(addr: string): string {
    const [local, domain] = addr.split('@');
    if (!local || !domain) return addr;
    return local.slice(0, 2) + '**@' + domain;
  }

  async function sendOtp(targetEmail: string) {
    // The message router wraps the response as { success: true, data: <handler result> }
    const otpResp = await chrome.runtime.sendMessage({
      action: 'REQUEST_OTP',
      payload: { email: targetEmail },
    }) as { success?: boolean; data?: { success?: boolean; email?: string; error?: string; retryAfterSec?: number }; error?: string } | undefined;

    // Support both direct and wrapped response shapes
    const otpData = (otpResp?.data ?? otpResp) as { success?: boolean; email?: string; error?: string; retryAfterSec?: number } | undefined;
    return otpData;
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setStatus({ type: 'error', msg: 'Please enter your password.' }); return; }
    if (!email.includes('@')) { setStatus({ type: 'error', msg: 'Please enter a valid email address.' }); return; }
    
    setIsLoading(true);
    setStatus(null);
    try {
      // 1. Verify current password first
      const unlockResp = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password },
      }) as { data?: { success?: boolean; cooldownActive?: boolean } } | undefined;

      if (!unlockResp?.data?.success) {
        if (unlockResp?.data?.cooldownActive) {
          setStatus({ type: 'error', msg: 'Too many attempts. Cooldown is active — please wait.' });
        } else {
          setStatus({ type: 'error', msg: 'Incorrect password. Please try again.' });
        }
        setIsLoading(false);
        return;
      }

      // 2. Send OTP to the new email address
      const otpData = await sendOtp(email);

      if (otpData?.success) {
        setSentToEmail(email);
        setStep('verify');
        setResendCooldown(30); // start 30s cooldown immediately
        setStatus({ type: 'success', msg: `Verification code sent to ${maskEmail(email)}. Check your inbox.` });
      } else {
        // Use server-reported cooldown if it's a 429 rate limit response
        if (otpData?.retryAfterSec) setResendCooldown(otpData.retryAfterSec);
        setStatus({ type: 'error', msg: otpData?.error || 'Failed to send verification code. Is the OTP service running?' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not reach the service worker. Please reload.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setStatus(null);
    setOtp('');
    try {
      const otpData = await sendOtp(sentToEmail);
      if (otpData?.success) {
        setResendCooldown(30);
        setStatus({ type: 'success', msg: `New code sent to ${maskEmail(sentToEmail)}.` });
      } else {
        if (otpData?.retryAfterSec) setResendCooldown(otpData.retryAfterSec);
        setStatus({ type: 'error', msg: otpData?.error || 'Failed to resend code.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not resend code. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length !== 6) { setStatus({ type: 'error', msg: 'Please enter the 6-digit verification code.' }); return; }

    setIsLoading(true);
    setStatus(null);
    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'VERIFY_OTP',
        payload: { otp, purpose: 'verify' }
      }) as { success?: boolean; data?: { success?: boolean; error?: string }; error?: string } | undefined;

      // Support both direct and wrapped response shapes
      const respData = resp?.data ?? resp;

      if (respData?.success) {
        // Save new email + mark as verified in auth state
        const stored = await chrome.storage.local.get('vault_auth_state');
        const authState = (stored.vault_auth_state || {}) as AuthState;
        authState.recoveryEmail = sentToEmail;
        authState.emailVerified = true;
        await chrome.storage.local.set({ vault_auth_state: authState });

        setCurrentEmail(sentToEmail);
        setStatus({ type: 'success', msg: '✓ Recovery email verified and saved successfully!' });
        setStep('request');
        setPassword('');
        setEmail('');
        setOtp('');
        setSentToEmail('');
        setResendCooldown(0);
        await logActivity('EMAIL_CHANGE', `Recovery email set to ${sentToEmail}`);
      } else {
        setStatus({ type: 'error', msg: respData?.error || 'Invalid or expired code. Please try again.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden max-w-xl transition-colors duration-200">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recovery Email</h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">
          Set a verified email address to recover your account if you forget your password.
        </p>
        {currentEmail && (
          <div className="flex items-center gap-2 mt-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20 rounded-full px-2.5 py-0.5 font-medium">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {currentEmail}
            </span>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="px-6 pt-5 flex items-center gap-2">
        {['Add Email', 'Verify Code'].map((label, i) => {
          const isActive = (i === 0 && step === 'request') || (i === 1 && step === 'verify');
          const isDone = i === 0 && step === 'verify';
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-violet-600 dark:text-violet-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-white/30'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400' : isDone ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/[0.07] text-slate-400 dark:text-white/30'}`}>
                  {isDone ? '✓' : i + 1}
                </div>
                {label}
              </div>
              {i === 0 && <div className={`h-px w-6 ${step === 'verify' ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-slate-200 dark:bg-white/[0.08]'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Enter email + password */}
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
              placeholder="Enter your master password"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="email-input">
              New Recovery Email
            </label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
              placeholder="you@example.com"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
            />
            <p className="text-xs text-slate-400 dark:text-white/30 mt-1.5">
              A 6-digit verification code will be sent to this address.
            </p>
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
              {status.msg}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Sending code…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  Send Verification Code
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Step 2: Enter OTP */
        <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
          {/* Sent-to banner */}
          <div className="flex items-center gap-2.5 bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl px-4 py-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <p className="text-sm text-violet-700 dark:text-violet-300">
              Code sent to <strong>{maskEmail(sentToEmail)}</strong>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="otp-input">
              Enter 6-digit code
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setStatus(null); }}
              placeholder="000000"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-2xl tracking-widest text-center rounded-xl px-4 py-4 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors font-mono"
              autoFocus
            />
            <p className="text-xs text-slate-400 dark:text-white/30 mt-1.5 text-center">
              Code expires in 10 minutes.
            </p>
          </div>

          {status && (
            <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
              {status.msg}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('request'); setOtp(''); setStatus(null); setResendCooldown(0); }}
              className="flex-1 bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white/90 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="flex-1 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Verifying…
                </>
              ) : 'Verify & Save'}
            </button>
          </div>

          {/* Resend link */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              className={`text-xs font-medium transition-colors ${resendCooldown > 0 || isLoading ? 'text-slate-400 dark:text-white/30 cursor-default' : 'text-violet-600 dark:text-violet-400 hover:text-violet-500 cursor-pointer'}`}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive it? Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
