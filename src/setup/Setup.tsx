import { useState, useEffect } from 'react';
import { STORAGE_KEYS, DEFAULT_AUTH_STATE, DEFAULT_LOCK_STATE } from '@/lib/constants';
import { generateSalt, hashPassword } from '@/lib/crypto';
import type { AuthState, LockState } from '@/types';

// Direct storage helpers
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

function notifySW(action: string, payload?: unknown): void {
  chrome.runtime.sendMessage({ action, payload }, () => {
    void chrome.runtime.lastError;
  });
}

export function Setup() {
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [setupError, setSetupError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Timer countdown effect
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(t => t - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Load persisted setup state
  useEffect(() => {
    (async () => {
      const step = await storageGet<number>('vault_setup_step');
      const savedPw = await storageGet<string>('vault_setup_password');
      const savedEmail = await storageGet<string>('vault_setup_email');
      if (step === 2 || step === 3) setSetupStep(step as 1 | 2 | 3);
      if (savedPw) { setPassword(savedPw); setConfirm(savedPw); }
      if (savedEmail) setEmail(savedEmail);
    })();
  }, []);

  const handleStep1 = async () => {
    setSetupError('');
    if (password.length < 6) { setSetupError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setSetupError('Passwords do not match.'); return; }
    await storageSet('vault_setup_step', 2);
    await storageSet('vault_setup_password', password);
    setSetupStep(2);
  };

  const handleStep2 = async () => {
    setSetupError('');
    if (!email || !email.includes('@')) { setSetupError('Valid recovery email is required.'); return; }
    setSaving(true);
    try {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'REQUEST_OTP', payload: { email } }, resolve);
      });
      if (res?.success) {
        await storageSet('vault_setup_step', 3);
        await storageSet('vault_setup_email', email);
        setSetupStep(3);
        setResendTimer(30);
      } else {
        setSetupError(res?.error || 'Failed to send OTP.');
        if (res?.retryAfterSec) {
          setResendTimer(res.retryAfterSec);
        }
      }
    } catch (err) {
      setSetupError('Error communicating with background service.');
    } finally {
      setSaving(false);
    }
  };

  const handleResendOtp = async () => {
    setSetupError('');
    setSaving(true);
    try {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'REQUEST_OTP', payload: { email } }, resolve);
      });
      if (res?.success) {
        setResendTimer(30);
      } else {
        setSetupError(res?.error || 'Failed to send OTP.');
        if (res?.retryAfterSec) {
          setResendTimer(res.retryAfterSec);
        }
      }
    } catch (err) {
      setSetupError('Error communicating with background service.');
    } finally {
      setSaving(false);
    }
  };

  const handleStep3 = async () => {
    setSetupError('');
    if (otp.length !== 6) { setSetupError('Enter the 6-digit OTP.'); return; }
    setSaving(true);
    try {
      const res = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({ action: 'VERIFY_OTP', payload: { otp, purpose: 'verify' } }, resolve);
      });
      if (res?.success) {
        const salt = generateSalt();
        const hash = await hashPassword(password, salt);

        await storageSet('vault_password_hash', hash);
        await storageSet('vault_password_salt', salt);
        await storageSet('vault_recovery_email', email);

        const newAuth: AuthState = { ...DEFAULT_AUTH_STATE, hasPassword: true };
        await storageSet(STORAGE_KEYS.AUTH_STATE, newAuth);

        const newLock: LockState = { ...DEFAULT_LOCK_STATE, isLocked: false };
        await storageSet(STORAGE_KEYS.LOCK_STATE, newLock);

        notifySW('GET_STATE');
        
        // Clean up temp state
        await chrome.storage.local.remove(['vault_setup_step', 'vault_setup_password', 'vault_setup_email']);

        setIsDone(true);
      } else {
        setSetupError(res?.error || 'Invalid OTP.');
      }
    } catch (err) {
      setSetupError('Error verifying OTP.');
    } finally {
      setSaving(false);
    }
  };

  if (isDone) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-6">
        <div className="bg-white p-10 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] max-w-md w-full text-center border border-slate-100">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 mb-3 tracking-tight">Setup Complete!</h1>
          <p className="text-[13px] text-slate-500 mb-8 leading-relaxed">Your BrowserVault is now secure. You can close this tab and start using the extension securely.</p>
          <button onClick={() => window.close()} className="w-full bg-[#5a8bf7] hover:bg-[#4673d4] text-white text-[15px] font-semibold py-3.5 rounded-xl transition-all shadow-sm">
            Close Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 font-sans p-6">
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] border border-slate-100 max-w-[440px] w-full">
        <div className="flex flex-col items-center mb-8">
          <img src={chrome.runtime.getURL('icons/icon128.png')} alt="Logo" className="w-16 h-16 rounded-2xl shadow-md mb-5" />
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Welcome to BrowserVault</h1>
          <p className="text-[13px] text-slate-500 mt-2 text-center leading-relaxed max-w-[280px]">Follow these quick steps to secure your browser and protect your privacy.</p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className={`h-1.5 rounded-full transition-all duration-300 ${setupStep === step ? 'w-8 bg-[#5a8bf7]' : setupStep > step ? 'w-6 bg-slate-300' : 'w-2 bg-slate-200'}`} />
          ))}
        </div>

        {setupStep === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Master Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setSetupError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleStep1()} placeholder="Min. 6 characters" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#5a8bf7] focus:ring-2 focus:ring-[#5a8bf7]/20 transition-all pr-12" autoFocus />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#5a8bf7] transition-colors rounded-lg hover:bg-[#5a8bf7]/10">
                  {showPw ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Confirm Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setSetupError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleStep1()} placeholder="Re-enter password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#5a8bf7] focus:ring-2 focus:ring-[#5a8bf7]/20 transition-all pr-12" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-[#5a8bf7] transition-colors rounded-lg hover:bg-[#5a8bf7]/10">
                  {showPw ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>

            {setupError && <p className="text-red-500 text-[12px] font-medium text-center bg-red-50 py-2 rounded-lg">{setupError}</p>}

            <button onClick={handleStep1} disabled={!password || !confirm} className="w-full bg-[#5a8bf7] hover:bg-[#4673d4] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[15px] font-semibold py-3.5 rounded-xl transition-all shadow-sm mt-2 flex items-center justify-center gap-2">
              Save & Continue
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        )}

        {setupStep === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Recovery Email</label>
              <p className="text-[12px] text-slate-500 mb-3 ml-1 leading-relaxed">Required if you ever forget your master password.</p>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setSetupError(''); }} onKeyDown={(e) => e.key === 'Enter' && handleStep2()} placeholder="name@example.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#5a8bf7] focus:ring-2 focus:ring-[#5a8bf7]/20 transition-all" autoFocus />
            </div>
            
            {setupError && <p className="text-red-500 text-[12px] font-medium text-center bg-red-50 py-2 rounded-lg">{setupError}</p>}

            <button onClick={handleStep2} disabled={saving || !email} className="w-full bg-[#5a8bf7] hover:bg-[#4673d4] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[15px] font-semibold py-3.5 rounded-xl transition-all shadow-sm mt-2 flex items-center justify-center gap-2">
              {saving ? 'Sending OTP...' : 'Send OTP & Continue'}
            </button>
          </div>
        )}

        {setupStep === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="text-center mb-2">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5a8bf7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed px-4">We've sent a 6-digit verification code to <br/><strong className="text-slate-900">{email}</strong></p>
            </div>
            
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
                      setSetupError('');
                      if (index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
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
                    } else if (e.key === 'Enter') {
                      handleStep3();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pastedData = e.clipboardData.getData('Text').replace(/\D/g, '').slice(0, 6);
                    if (pastedData) {
                      setOtp(pastedData);
                      setSetupError('');
                      const focusIndex = Math.min(pastedData.length, 5);
                      document.getElementById(`otp-${focusIndex}`)?.focus();
                    }
                  }}
                  className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-bold text-slate-900 outline-none focus:border-[#5a8bf7] focus:bg-white focus:ring-4 focus:ring-[#5a8bf7]/10 transition-all font-mono shadow-sm"
                  autoFocus={index === 0}
                />
              ))}
            </div>
            
            {setupError && <p className="text-red-500 text-[12px] font-medium text-center bg-red-50 py-2 rounded-lg">{setupError}</p>}

            <button onClick={handleStep3} disabled={saving || otp.length !== 6} className="w-full bg-[#10b981] hover:bg-[#059669] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[15px] font-semibold py-3.5 rounded-xl transition-all shadow-sm mt-4 flex items-center justify-center gap-2">
              {saving ? 'Verifying...' : 'Complete Setup'}
            </button>

            <div className="text-center mt-3">
              <button 
                onClick={handleResendOtp} 
                disabled={saving || resendTimer > 0} 
                className="text-[13px] font-medium text-[#5a8bf7] hover:text-[#4673d4] disabled:text-slate-400 transition-colors bg-transparent border-none cursor-pointer disabled:cursor-default"
              >
                {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
