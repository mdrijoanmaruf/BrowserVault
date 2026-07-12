/**
 * ChangeEmailPage — Day 15 (Nav placeholder & basic form)
 */

import { useState, useEffect } from 'react';
import { logActivity } from '@/lib/activityLog';
import type { AuthState } from '@/types';
import { LuEye, LuEyeOff, LuMail } from 'react-icons/lu';

export function ChangeEmailPage() {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState<{
    type: 'error' | 'success';
    msg: string;
  } | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [isLoading, setIsLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    chrome.storage.local.get('vault_auth_state').then((res) => {
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
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
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
    const otpResp = (await chrome.runtime.sendMessage({
      action: 'REQUEST_OTP',
      payload: { email: targetEmail },
    })) as
      | {
          success?: boolean;
          data?: {
            success?: boolean;
            email?: string;
            error?: string;
            retryAfterSec?: number;
          };
          error?: string;
        }
      | undefined;

    const otpData = (otpResp?.data ?? otpResp) as
      | {
          success?: boolean;
          email?: string;
          error?: string;
          retryAfterSec?: number;
        }
      | undefined;
    return otpData;
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setStatus({ type: 'error', msg: 'Please enter your password.' });
      return;
    }
    if (!email.includes('@')) {
      setStatus({ type: 'error', msg: 'Please enter a valid email address.' });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    try {
      // 1. Verify current password first
      const unlockResp = (await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password },
      })) as
        { data?: { success?: boolean; cooldownActive?: boolean } } | undefined;

      if (!unlockResp?.data?.success) {
        if (unlockResp?.data?.cooldownActive) {
          setStatus({
            type: 'error',
            msg: 'Too many attempts. Cooldown is active — please wait.',
          });
        } else {
          setStatus({
            type: 'error',
            msg: 'Incorrect password. Please try again.',
          });
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
        setStatus({
          type: 'success',
          msg: `Verification code sent to ${maskEmail(email)}. Check your inbox.`,
        });
      } else {
        if (otpData?.retryAfterSec) setResendCooldown(otpData.retryAfterSec);
        setStatus({
          type: 'error',
          msg:
            otpData?.error ||
            'Failed to send verification code. Is the OTP service running?',
        });
      }
    } catch {
      setStatus({
        type: 'error',
        msg: 'Could not reach the service worker. Please reload.',
      });
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
        setStatus({
          type: 'success',
          msg: `New code sent to ${maskEmail(sentToEmail)}.`,
        });
      } else {
        if (otpData?.retryAfterSec) setResendCooldown(otpData.retryAfterSec);
        setStatus({
          type: 'error',
          msg: otpData?.error || 'Failed to resend code.',
        });
      }
    } catch {
      setStatus({
        type: 'error',
        msg: 'Could not resend code. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setStatus({
        type: 'error',
        msg: 'Please enter the 6-digit verification code.',
      });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    try {
      const resp = (await chrome.runtime.sendMessage({
        action: 'VERIFY_OTP',
        payload: { otp, purpose: 'verify' },
      })) as
        | {
            success?: boolean;
            data?: { success?: boolean; error?: string };
            error?: string;
          }
        | undefined;

      const respData = resp?.data ?? resp;

      if (respData?.success) {
        const stored = await chrome.storage.local.get('vault_auth_state');
        const authState = (stored.vault_auth_state || {}) as AuthState;
        authState.recoveryEmail = sentToEmail;
        authState.emailVerified = true;
        await chrome.storage.local.set({ vault_auth_state: authState });

        setCurrentEmail(sentToEmail);
        setStatus({
          type: 'success',
          msg: '✓ Recovery email verified and saved successfully!',
        });
        setStep('request');
        setPassword('');
        setEmail('');
        setOtp('');
        setSentToEmail('');
        setResendCooldown(0);
        await logActivity(
          'EMAIL_CHANGE',
          `Recovery email set to ${sentToEmail}`
        );
      } else {
        setStatus({
          type: 'error',
          msg: respData?.error || 'Invalid or expired code. Please try again.',
        });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm transition-colors duration-200 w-full max-w-xl">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-100 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">
          Recovery Email
        </h2>
        <p className="text-[13px] text-slate-500 dark:text-white/40 mt-1 font-medium">
          Set a verified email address to recover your account if you forget
          your password.
        </p>
      </div>

      {/* Step indicator */}
      <div className="px-8 pt-6 flex items-center gap-2">
        {['Add Email', 'Verify Code'].map((label, i) => {
          const isActive =
            (i === 0 && step === 'request') || (i === 1 && step === 'verify');
          const isDone = i === 0 && step === 'verify';
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 text-[13px] font-semibold ${isActive ? 'text-[#5b32f5] dark:text-violet-400' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-white/30'}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-violet-100 dark:bg-violet-500/20 text-[#5b32f5] dark:text-violet-400' : isDone ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/[0.07] text-slate-400 dark:text-white/30'}`}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                {label}
              </div>
              {i === 0 && (
                <div
                  className={`h-px w-6 ${step === 'verify' ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-slate-200 dark:bg-white/[0.08]'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1: Enter email + password */}
      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="p-8 space-y-6">
          {currentEmail && (
            <div>
              <label className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2">
                Current Recovery Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={currentEmail}
                  disabled
                  className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-white/40 text-[14px] font-medium rounded-xl px-4 py-3 pl-10 focus:outline-none transition-colors cursor-not-allowed"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <LuMail size={18} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label
              className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2"
              htmlFor="pwd-input"
            >
              Current Password
            </label>
            <div className="relative">
              <input
                id="pwd-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setStatus(null);
                }}
                placeholder="Enter your master password"
                className="w-full bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[14px] font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label
              className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2"
              htmlFor="email-input"
            >
              New Recovery Email
            </label>
            <div className="relative">
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus(null);
                }}
                placeholder="you@example.com"
                className="w-full bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[14px] font-medium rounded-xl px-4 py-3 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
              />
            </div>
            <p className="text-[13px] text-slate-400 dark:text-white/30 mt-2 font-medium">
              A 6-digit verification code will be sent to this address.
            </p>
          </div>

          {status && (
            <div
              className={`p-4 rounded-xl text-[14px] font-semibold ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}
            >
              {status.msg}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-[#5b32f5] hover:bg-[#4a26d4] focus:ring-2 focus:ring-[#5b32f5]/40 text-white px-5 py-3 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M12 2a10 10 0 0110 10"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Sending code…
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Step 2: Enter OTP */
        <form onSubmit={handleVerifyOtp} className="p-8 space-y-6">
          {/* Sent-to banner */}
          <div className="flex items-center gap-3 bg-[#f4f1fe] dark:bg-violet-500/10 border border-[#e5ddff] dark:border-violet-500/20 rounded-xl px-5 py-4">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5b32f5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            <p className="text-[14px] text-[#5b32f5] dark:text-violet-300 font-medium">
              Code sent to <strong>{maskEmail(sentToEmail)}</strong>
            </p>
          </div>

          <div>
            <label
              className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2"
              htmlFor="otp-input"
            >
              Enter 6-digit code
            </label>
            <div className="flex justify-between gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={otp[index] || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val) {
                      const newOtp = otp.split('');
                      newOtp[index] = val.slice(-1);
                      const finalOtp = newOtp.join('');
                      setOtp(finalOtp);
                      setStatus(null);
                      if (index < 5)
                        document.getElementById(`otp-${index + 1}`)?.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace') {
                      e.preventDefault();
                      const newOtp = otp.split('');
                      if (newOtp[index]) {
                        newOtp[index] = '';
                        setOtp(newOtp.join(''));
                      } else if (index > 0) {
                        newOtp[index - 1] = '';
                        setOtp(newOtp.join(''));
                        document.getElementById(`otp-${index - 1}`)?.focus();
                      }
                    } else if (e.key === 'ArrowLeft' && index > 0) {
                      document.getElementById(`otp-${index - 1}`)?.focus();
                    } else if (e.key === 'ArrowRight' && index < 5) {
                      document.getElementById(`otp-${index + 1}`)?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedData = e.clipboardData
                      .getData('Text')
                      .replace(/\D/g, '')
                      .slice(0, 6);
                    if (pastedData) {
                      setOtp(pastedData);
                      setStatus(null);
                      const focusIndex = Math.min(pastedData.length, 5);
                      document.getElementById(`otp-${focusIndex}`)?.focus();
                    }
                  }}
                  className="w-12 h-14 bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white rounded-xl text-center text-2xl font-bold outline-none focus:border-[#5b32f5] focus:ring-2 focus:ring-[#5b32f5]/20 transition-all font-mono shadow-sm"
                  autoFocus={index === 0}
                />
              ))}
            </div>
            <p className="text-[13px] text-slate-400 dark:text-white/30 mt-2 text-center font-medium">
              Code expires in 10 minutes.
            </p>
          </div>

          {status && (
            <div
              className={`p-4 rounded-xl text-[14px] font-semibold ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}
            >
              {status.msg}
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setOtp('');
                setStatus(null);
                setResendCooldown(0);
              }}
              className="flex-1 bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white/90 px-5 py-3 rounded-xl text-[14px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20 shadow-sm"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="flex-[2] bg-[#5b32f5] hover:bg-[#4a26d4] focus:ring-2 focus:ring-[#5b32f5]/40 text-white px-5 py-3 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth="3"
                    />
                    <path
                      d="M12 2a10 10 0 0110 10"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  Verifying…
                </>
              ) : (
                'Verify & Save'
              )}
            </button>
          </div>

          {/* Resend link */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isLoading}
              className={`text-[13px] font-semibold transition-colors ${resendCooldown > 0 || isLoading ? 'text-slate-400 dark:text-white/30 cursor-default' : 'text-[#5b32f5] dark:text-violet-400 hover:text-[#4a26d4] cursor-pointer'}`}
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Didn't receive it? Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
