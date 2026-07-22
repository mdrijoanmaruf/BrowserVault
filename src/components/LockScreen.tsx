import React, { useState, useEffect, useCallback } from 'react';
import { verifyBiometrics } from '@/lib/webauthn';

type LockMode =
  'setup' | 'unlock' | 'cooldown' | 'backup-codes' | 'forgot' | 'otp-verify';

// Direct storage helpers (no SW)
function directStorageSet(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

interface LockScreenProps {
  onHide?: () => void;
}

const KEYFRAMES = `
  @keyframes bvFadeIn {
    from { opacity: 0; transform: scale(0.96) translateY(16px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);    }
  }
  @keyframes bvShake {
    0%,100% { transform: translateX(0); }
    15%     { transform: translateX(-10px); }
    30%     { transform: translateX(9px);  }
    45%     { transform: translateX(-7px); }
    60%     { transform: translateX(6px);  }
    75%     { transform: translateX(-3px); }
    90%     { transform: translateX(2px);  }
  }
  @keyframes bvBlob {
    0%,100% { opacity: 0.18; transform: scale(1);   }
    50%     { opacity: 0.28; transform: scale(1.08); }
  }
  @keyframes bvSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes bvCountdown {
    from { stroke-dashoffset: 0; }
    to   { stroke-dashoffset: 251; }
  }
  .bv-card-enter { animation: bvFadeIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .bv-shake      { animation: bvShake  0.5s ease-in-out; }
  .bv-blob-1     { animation: bvBlob 5s ease-in-out infinite; }
  .bv-blob-2     { animation: bvBlob 5s ease-in-out infinite 2.5s; }
  .bv-spin       { animation: bvSpin 1s linear infinite; }
  .bv-input-container:focus-within {
    border-color: rgba(167, 139, 250, 0.55) !important;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
  }
  .bv-input::placeholder {
    color: var(--icon-color, rgba(15, 23, 42, 0.45));
    opacity: 0.7;
  }
  .bv-input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .bv-btn-primary:not(:disabled):hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(109, 40, 217, 0.55) !important;
  }
  .bv-btn-primary:not(:disabled):active { transform: translateY(0); }
  .bv-btn-secondary:hover {
    background: rgba(255,255,255,0.08) !important;
    border-color: rgba(255,255,255,0.2) !important;
  }
  .bv-link:hover { color: rgba(167, 139, 250, 0.85) !important; }
  .bv-eye:hover  { color: rgba(255,255,255,0.7) !important; }
`;

function formatSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
      />
    </svg>
  );
}

function EyeOnIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

export function PasswordField({
  id,
  value,
  onChange,
  onKeyEnter,
  placeholder,
  showPassword,
  onToggleShow,
  autoFocus,
  styleVars,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onKeyEnter: () => void;
  placeholder: string;
  showPassword: boolean;
  onToggleShow: () => void;
  autoFocus?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styleVars?: any;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!autoFocus) return;

    const doFocus = () => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      try {
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      } catch {}
    };

    const onWindowFocus = () => {
      setTimeout(doFocus, 30);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(doFocus, 30);
      }
    };

    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (typeof chrome !== 'undefined' && chrome.windows) {
      chrome.windows.getCurrent((win) => {
        if (win && win.id) {
          chrome.windows.update(win.id, { focused: true }, doFocus);
        }
      });
    }

    doFocus();
    const timers = [50, 150, 300, 600, 1000, 1500, 2500].map((delay) =>
      setTimeout(doFocus, delay)
    );

    return () => {
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      timers.forEach(clearTimeout);
    };
  }, [autoFocus]);

  return (
    <div style={{ marginBottom: 16, ...styleVars }}>
      <div
        className="bv-input-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
          border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
          borderRadius: 12,
          padding: '0 16px',
          height: 48,
          transition: 'all 0.2s',
          color: 'var(--text-main, white)',
        }}
      >
        {/* Lock icon on the left (as in design) */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: 'var(--icon-color, rgba(15, 23, 42, 0.45))',
            marginRight: 12,
          }}
        >
          <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>

        <input
          ref={inputRef}
          className="bv-input"
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onKeyEnter();
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={
            id === 'bv-password' ? 'current-password' : 'new-password'
          }
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: '100%',
            color: 'inherit',
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 4,
            cursor: 'pointer',
            color: 'var(--icon-color, rgba(15, 23, 42, 0.45))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showPassword ? <EyeOffIcon /> : <EyeOnIcon />}
        </button>
      </div>
    </div>
  );
}

/** Circular countdown ring for cooldown mode */
function CooldownRing({
  remainingMs,
  totalMs,
  c,
}: {
  remainingMs: number;
  totalMs: number;
  c?: any;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, remainingMs / totalMs);
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}
    >
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={c?.inputBorder || "rgba(255,255,255,0.08)"}
            strokeWidth="6"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="url(#bvCooldownGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
          <defs>
            <linearGradient
              id="bvCooldownGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: c?.textMain || 'white',
              fontSize: 18,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatSeconds(remainingMs)}
          </span>
          <span
            style={{
              color: c?.textMuted || 'rgba(255,255,255,0.35)',
              fontSize: 10,
              marginTop: 1,
            }}
          >
            remaining
          </span>
        </div>
      </div>
    </div>
  );
}

export function LockScreen({ onHide }: LockScreenProps) {
  const [mode, setMode] = useState<LockMode>('unlock');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [time, setTime] = useState(new Date());

  const [maxAttempts, setMaxAttempts] = useState(5);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null
  );

  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [backupCodes] = useState<string[] | null>(null);

  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(
    null
  );
  const COOLDOWN_TOTAL_MS = 5 * 60 * 1000;

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // ── Forgot password wizard state ─────────────────────────────────────────
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [otpInput, setOtpInput] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const [noRecoveryEmail, setNoRecoveryEmail] = useState(false);
  const resendTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Load initial state directly from storage (no SW needed)
  useEffect(() => {
    (async () => {
      try {
        // Read auth state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await new Promise<Record<string, any>>((resolve) => {
          chrome.storage.local.get(
            ['vault_auth_state', 'vault_lock_state', 'vault_settings'],
            (r) => resolve(r || {})
          );
        });

        const authState = result['vault_auth_state'];
        const lockState = result['vault_lock_state'];
        const settings = result['vault_settings'];

        // Theme
        if (settings?.theme) {
          const t = settings.theme;
          if (t === 'system') {
            const isDark = window.matchMedia(
              '(prefers-color-scheme: dark)'
            ).matches;
            setTheme(isDark ? 'dark' : 'light');
          } else {
            setTheme(t as 'light' | 'dark');
          }
        }

        // Biometrics
        if (settings?.biometricUnlockEnabled && authState?.hasBiometrics) {
          setBiometricsEnabled(true);
        }

        // No password set yet
        if (!authState?.hasPassword) {
          setMode('setup');
          return;
        }

        // Max attempts
        const maxAtt = settings?.maxAttempts ?? 5;
        setMaxAttempts(maxAtt);
        const failed = lockState?.failedAttemptCount ?? 0;
        setRemainingAttempts(maxAtt - failed);

        // Cooldown
        const expiresAt = lockState?.cooldownExpiresAt;
        if (expiresAt && Date.now() < expiresAt) {
          setCooldownExpiresAt(expiresAt);
          setCooldownRemainingMs(expiresAt - Date.now());
        }
      } catch {
        // Default to unlock mode on error
      } finally {
        setTimeout(() => {
          const input = document.getElementById('bv-password') as HTMLInputElement | null;
          if (input) {
            input.focus();
            try {
              const len = input.value.length;
              input.setSelectionRange(len, len);
            } catch {}
          }
        }, 50);
      }
    })();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (mode !== 'cooldown' || cooldownExpiresAt === null) return;

    const id = setInterval(() => {
      const remaining = cooldownExpiresAt - Date.now();
      if (remaining <= 0) {
        clearInterval(id);
        setCooldownExpiresAt(null);
        setCooldownRemainingMs(0);
        setRemainingAttempts(maxAttempts);
        setMode('unlock');
      } else {
        setCooldownRemainingMs(remaining);
      }
    }, 500);

    return () => clearInterval(id);
  }, [mode, cooldownExpiresAt, maxAttempts]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  }, []);

  const clearError = useCallback(() => setError(''), []);

  function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '**@' + (domain || '?');
    return local.slice(0, 2) + '**@' + domain;
  }

  function startResendCooldown(seconds: number) {
    setResendCooldown(seconds);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendTimerRef.current!);
          resendTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function resetForgotState() {
    setForgotStep(1);
    setOtpInput('');
    setMaskedEmail('');
    setResendCooldown(0);
    setNoRecoveryEmail(false);
    setPassword('');
    setConfirmPassword('');
    clearError();
    if (resendTimerRef.current) {
      clearInterval(resendTimerRef.current);
      resendTimerRef.current = null;
    }
  }

  const handleBiometricUnlock = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { success, error } = await verifyBiometrics();
      if (success) {
        const response = (await chrome.runtime.sendMessage({
          action: 'UNLOCK_WITH_BIOMETRICS',
        })) as { data?: { success?: boolean } } | undefined;
        if (response?.data?.success) {
          onHide?.();
        } else {
          setError('Failed to unlock browser.');
          triggerShake();
        }
      } else {
        setError(error || 'Biometric verification failed.');
        triggerShake();
      }
    } catch {
      setError('Error communicating with biometrics.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  }, [onHide, triggerShake]);

  const handleSendForgotOtp = useCallback(async () => {
    setIsLoading(true);
    clearError();
    try {
      const raw = (await chrome.runtime.sendMessage({
        action: 'REQUEST_OTP',
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
      // Message router wraps as { success, data: <handler result> }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = (raw as any)?.data ?? raw;
      if (resp?.success && resp.email) {
        setMaskedEmail(maskEmail(resp.email));
        setForgotStep(2);
        startResendCooldown(30);
      } else {
        const msg = resp?.error || 'Failed to send OTP.';
        if (msg.includes('No email') || msg.includes('recovery email')) {
          setNoRecoveryEmail(true);
        }
        // If server sent a cooldown time, apply it so Resend is disabled
        if (resp?.retryAfterSec) startResendCooldown(resp.retryAfterSec);
        setError(msg);
      }
    } catch {
      setError('Could not contact the OTP service. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  }, [clearError]);

  const handleVerifyForgotOtp = useCallback(async () => {
    if (otpInput.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    setIsLoading(true);
    clearError();
    try {
      const resp = (await chrome.runtime.sendMessage({
        action: 'VERIFY_OTP',
        payload: { otp: otpInput, purpose: 'forgot' },
      })) as { success: boolean; error?: string };
      if (resp?.success) {
        setForgotStep(3);
      } else {
        setError(resp?.error || 'Invalid or expired code.');
        triggerShake();
      }
    } catch {
      setError('Verification error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [otpInput, clearError, triggerShake]);

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError('Please enter your password.');
      triggerShake();
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      // Verify password directly from storage — no SW required
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await new Promise<Record<string, any>>((resolve) => {
        chrome.storage.local.get(
          [
            'vault_password_hash',
            'vault_password_salt',
            'vault_lock_state',
            'vault_settings',
          ],
          (r) => resolve(r || {})
        );
      });

      const storedHash = result['vault_password_hash'] as string | undefined;
      const storedSalt = result['vault_password_salt'] as string | undefined;

      if (!storedHash || !storedSalt) {
        setMode('setup');
        setIsLoading(false);
        return;
      }

      // Check cooldown
      const lockState = result['vault_lock_state'];
      if (
        lockState?.cooldownExpiresAt &&
        Date.now() < lockState.cooldownExpiresAt
      ) {
        setCooldownExpiresAt(lockState.cooldownExpiresAt);
        setCooldownRemainingMs(lockState.cooldownExpiresAt - Date.now());
        setMode('cooldown');
        setIsLoading(false);
        return;
      }

      // Dynamic import of verifyPassword (included in bundle)
      const { verifyPassword } = await import('@/lib/crypto');
      const isValid = await verifyPassword(password, storedHash, storedSalt);

      const settings = result['vault_settings'];
      const maxAtt = settings?.maxAttempts ?? maxAttempts;

      if (isValid) {
        // Unlock: update storage
        const newLock = {
          ...(lockState ?? {}),
          isLocked: false,
          failedAttemptCount: 0,
          cooldownExpiresAt: null,
        };
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ vault_lock_state: newLock }, () =>
            resolve()
          );
        });
        // Tell the Service Worker to restore windows from fullscreen
        chrome.runtime.sendMessage({ action: 'RESTORE_WINDOWS' }).catch(() => {});
        onHide?.();
      } else {
        // Record failed attempt
        const currentFailed = (lockState?.failedAttemptCount ?? 0) + 1;
        const newLock = {
          ...(lockState ?? {}),
          failedAttemptCount: currentFailed,
        };

        if (currentFailed >= maxAtt) {
          const cooldownEnd = Date.now() + 5 * 60 * 1000;
          newLock.cooldownExpiresAt = cooldownEnd;
          await new Promise<void>((resolve) => {
            chrome.storage.local.set({ vault_lock_state: newLock }, () =>
              resolve()
            );
          });
          setCooldownExpiresAt(cooldownEnd);
          setCooldownRemainingMs(5 * 60 * 1000);
          setMode('cooldown');
        } else {
          await new Promise<void>((resolve) => {
            chrome.storage.local.set({ vault_lock_state: newLock }, () =>
              resolve()
            );
          });
          const remaining = maxAtt - currentFailed;
          setRemainingAttempts(remaining);
          setError(
            `Incorrect password — ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          );
          triggerShake();
          setPassword('');
        }
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      console.error('[LockScreen] unlock error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [password, onHide, triggerShake, maxAttempts]);

  const handleSetup = useCallback(async () => {
    if (!password) {
      setError('Please enter a password.');
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      triggerShake();
      return;
    }
    if (!recoveryEmail) {
      setError('Please enter a recovery email.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Import crypto utilities dynamically
      const { generateSalt, hashPassword } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      // Write directly to storage
      await directStorageSet({
        vault_password_hash: hash,
        vault_password_salt: salt,
        vault_recovery_email: recoveryEmail,
        vault_auth_state: {
          hasPassword: true,
          hasPin: false,
          emailVerified: false,
          hasBackupCodes: false,
          hasBiometrics: false,
        },
        vault_lock_state: {
          isLocked: false,
          failedAttemptCount: 0,
          cooldownExpiresAt: null,
        },
      });

      // Notify SW (best-effort)
      chrome.runtime.sendMessage({ action: 'GET_STATE' }, () => {
        void chrome.runtime.lastError;
      });
      // Restore windows from fullscreen
      chrome.runtime.sendMessage({ action: 'RESTORE_WINDOWS' }).catch(() => {});

      onHide?.();
    } catch (err) {
      setError('Failed to save password. Please try again.');
      console.error('[LockScreen] setup error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, onHide, triggerShake]);

  // "Forgot Password" → reset password after OTP verification (Step 3)
  const handleResetPassword = useCallback(async () => {
    if (!password) {
      setError('Please enter a new password.');
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const { generateSalt, hashPassword } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword(password, salt);

      // Update password and unlock
      await directStorageSet({
        vault_password_hash: hash,
        vault_password_salt: salt,
        vault_auth_state: {
          hasPassword: true,
          hasPin: false,
          emailVerified: false,
          hasBackupCodes: false,
          hasBiometrics: false,
        },
        vault_lock_state: {
          isLocked: false,
          failedAttemptCount: 0,
          cooldownExpiresAt: null,
        },
      });

      chrome.runtime.sendMessage({ action: 'GET_STATE' }, () => {
        void chrome.runtime.lastError;
      });
      // Restore windows from fullscreen
      chrome.runtime.sendMessage({ action: 'RESTORE_WINDOWS' }).catch(() => {});
      onHide?.();
    } catch (err) {
      setError('Failed to reset password. Please try again.');
      console.error('[LockScreen] reset error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, onHide, triggerShake]);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const modeTitle =
    mode === 'setup'
      ? 'Welcome to BrowserVault'
      : mode === 'forgot'
        ? 'Account Recovery'
        : mode === 'cooldown'
          ? 'Too Many Failed Attempts'
          : 'BrowserVault';

  const modeSubtitle =
    mode === 'setup'
      ? 'Create a password to secure your browser'
      : mode === 'forgot' && forgotStep === 1
        ? 'Verify your identity to reset your password'
        : mode === 'forgot' && forgotStep === 2
          ? 'Enter the code sent to your email'
          : mode === 'forgot' && forgotStep === 3
            ? 'Create a new master password'
            : mode === 'cooldown'
              ? 'Please wait before trying again'
              : 'Your browser is locked';

  const submitHandler = mode === 'setup' ? handleSetup : handleUnlock;

  const toggleTheme = useCallback(async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const result = await new Promise<any>((resolve) => {
      chrome.storage.local.get(['vault_settings'], (r) => resolve(r));
    });
    const currentSettings = result.vault_settings || {};
    await directStorageSet({
      vault_settings: { ...currentSettings, theme: newTheme }
    });
    try {
      chrome.runtime.sendMessage({ action: 'UPDATE_SETTINGS', payload: { theme: newTheme } }).catch(() => {});
    } catch {}
  }, [theme]);

  const handleCloseBrowser = useCallback(() => {
    try {
      chrome.runtime.sendMessage({ action: 'CLOSE_CURRENT_TAB' }).catch(() => {});
    } catch {}
    window.close();
  }, []);

  const isLight = theme === 'light';
  const c = isLight ? {
    bg: 'linear-gradient(135deg, #f0f4fd 0%, #ffffff 100%)',
    bgCooldown: 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 45%, #fef2f2 100%)',
    textMain: '#0f172a',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    glassBg: '#ffffff',
    glassBorder: 'rgba(15, 23, 42, 0.04)',
    inputBg: '#fafafa',
    inputBorder: 'rgba(15, 23, 42, 0.1)',
    iconColor: '#94a3b8',
    clockMain: '#0f172a',
    clockSec: '#5a8bf7',
    dots: '#94a3b8'
  } : {
    bg: 'linear-gradient(135deg, #0d0b1e 0%, #151136 100%)',
    bgCooldown: 'linear-gradient(145deg, #2a0b12 0%, #3e121a 45%, #2a0b12 100%)',
    textMain: '#ffffff',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',
    glassBg: 'rgba(255, 255, 255, 0.03)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    inputBg: 'rgba(255, 255, 255, 0.05)',
    inputBorder: 'rgba(255, 255, 255, 0.1)',
    iconColor: '#94a3b8',
    clockMain: '#ffffff',
    clockSec: '#5a8bf7',
    dots: 'rgba(255,255,255,0.2)'
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483647,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          overflow: 'hidden',
          background: mode === 'cooldown' ? c.bgCooldown : c.bg,
          color: c.textMain,
          transition: 'background 0.3s, color 0.3s'
        }}
      >
        {/* Top Right Controls */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            zIndex: 10,
            display: 'flex',
            gap: 12,
          }}
        >
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: c.glassBg,
              border: `1px solid ${c.glassBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.textMuted,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Toggle Theme"
            onMouseEnter={(e) => {
              e.currentTarget.style.color = c.textMain;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = c.textMuted;
            }}
          >
            {isLight ? (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          {/* Close Browser/Tab */}
          <button
            onClick={handleCloseBrowser}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Close Tab"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Subtle dot patterns in background */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.4,
            backgroundImage: `radial-gradient(${c.dots} 1px, transparent 0)`,
            backgroundSize: '24px 24px',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-5%',
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(90,139,247,0.05) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            right: '-5%',
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(134,93,245,0.05) 0%, rgba(255,255,255,0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: 420,
            padding: '0 24px',
            textAlign: 'center',
          }}
        >
          {/* Clock */}
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 300,
                  color: c.clockMain,
                  letterSpacing: '-2px',
                  lineHeight: 1,
                }}
              >
                {hours}:{minutes}
              </span>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 300,
                  color: c.clockSec,
                  marginLeft: 8,
                  letterSpacing: '-1px',
                }}
              >
                {seconds}
              </span>
            </div>
            <div
              style={{
                color: c.textMuted,
                fontSize: 14,
                marginTop: 12,
                fontWeight: 400,
              }}
            >
              {dateStr}
            </div>
          </div>

          {/* Card */}
          <div
            className={`bv-card-enter${isShaking ? ' bv-shake' : ''}`}
            style={{
              background: c.glassBg,
              border: `1px solid ${c.glassBorder}`,
              borderRadius: 24,
              padding: 32,
              boxShadow: isLight
                ? '0 24px 48px -12px rgba(90, 139, 247, 0.15), 0 0 0 1px rgba(255,255,255,0.8) inset'
                : '0 24px 48px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
            }}
          >
            {/* Logo */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: isLight
                    ? 'linear-gradient(135deg, #eff4ff 0%, #e0ebff 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <img
                  src={chrome.runtime.getURL('icons/icon128.png')}
                  alt="BrowserVault Logo"
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 12,
                    boxShadow: '0 8px 16px rgba(90, 139, 247, 0.3)',
                  }}
                />
              </div>
            </div>

            <h1
              style={{
                color: c.textMain,
                fontSize: 20,
                fontWeight: 800,
                margin: '0 0 8px',
                letterSpacing: '-0.3px',
              }}
            >
              {modeTitle}
            </h1>
            <p
              style={{
                color: c.textMuted,
                fontSize: 13,
                margin: '0 0 28px',
                lineHeight: 1.5,
                fontWeight: 500,
              }}
            >
              {modeSubtitle}
            </p>

            {/* ── Cooldown mode ── */}
            {mode === 'cooldown' && (
              <>
                <CooldownRing
                  remainingMs={cooldownRemainingMs}
                  totalMs={COOLDOWN_TOTAL_MS}
                  c={c}
                />
                <div
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.18)',
                    borderRadius: 12,
                    padding: '12px 16px',
                  }}
                >
                  <p
                    style={{
                      color: c.textMuted,
                      fontSize: 12,
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    Too many failed attempts. Password entry is temporarily
                    disabled to protect your data. You can try again in{' '}
                    <strong style={{ color: '#ef4444' }}>
                      {formatSeconds(cooldownRemainingMs)}
                    </strong>
                    .
                  </p>
                </div>
              </>
            )}

            {/* ── Unlock / Setup forms ── */}
            {mode === 'backup-codes' && backupCodes && (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p
                  style={{
                    margin: '0 0 16px',
                    fontSize: 13,
                    color: c.textSubtle,
                    lineHeight: 1.5,
                  }}
                >
                  These backup codes can be used to unlock your vault if you
                  forget your password. They will only be shown once. Please
                  save them.
                </p>
                <div
                  style={{
                    background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                    padding: 12,
                    borderRadius: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                    fontFamily: 'monospace',
                    fontSize: 14,
                    color: isLight ? '#6366f1' : '#a78bfa',
                  }}
                >
                  {backupCodes.map((code, idx) => (
                    <div key={idx} style={{ userSelect: 'all' }}>
                      {code}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'));
                    onHide?.();
                  }}
                  style={{
                    marginTop: 20,
                    width: '100%',
                    background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
                    border:
                      '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
                    padding: '12px',
                    borderRadius: 12,
                    color: c.textMain,
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                >
                  Copy to Clipboard & Continue
                </button>
              </div>
            )}

            {(mode === 'unlock' || mode === 'setup') && (
              <>
                <PasswordField
                  id="bv-password"
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    clearError();
                  }}
                  onKeyEnter={submitHandler}
                  placeholder={
                    mode === 'setup'
                      ? 'New password (min. 6 characters)'
                      : 'Enter your password'
                  }
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword((v) => !v)}
                  autoFocus
                  styleVars={{
                    '--input-bg': c.inputBg,
                    '--input-border': c.inputBorder,
                    '--text-main': c.textMain,
                    '--icon-color': c.iconColor,
                  }}
                />

                {mode === 'setup' && (
                  <>
                    <PasswordField
                      id="bv-confirm-password"
                      value={confirmPassword}
                      onChange={(v) => {
                        setConfirmPassword(v);
                        clearError();
                      }}
                      onKeyEnter={submitHandler}
                      placeholder="Confirm password"
                      showPassword={showPassword}
                      onToggleShow={() => setShowPassword((v) => !v)}
                      styleVars={{
                        '--input-bg': c.inputBg,
                        '--input-border': c.inputBorder,
                        '--text-main': c.textMain,
                      }}
                    />
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: c.inputBg,
                          border: `1px solid ${c.inputBorder}`,
                          borderRadius: 12,
                          padding: '0 16px',
                          height: 48,
                          color: c.textMain,
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: c.iconColor, marginRight: 12 }}
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        <input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => {
                            setRecoveryEmail(e.target.value);
                            clearError();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitHandler();
                          }}
                          placeholder="Recovery email"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            width: '100%',
                            color: 'inherit',
                            fontSize: 14,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Attempts remaining indicator */}
                {mode === 'unlock' &&
                  remainingAttempts !== null &&
                  remainingAttempts < maxAttempts && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 4 }}>
                        {Array.from({ length: maxAttempts }).map((_, i) => (
                          <div
                            key={i}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background:
                                i < remainingAttempts
                                  ? remainingAttempts <= 1
                                    ? '#ef4444'
                                    : remainingAttempts <= 2
                                      ? '#f97316'
                                      : '#a78bfa'
                                  : 'rgba(255,255,255,0.15)',
                            }}
                          />
                        ))}
                      </div>
                      <span
                        style={{
                          color:
                            remainingAttempts <= 1
                              ? '#fca5a5'
                              : remainingAttempts <= 2
                                ? '#fdba74'
                                : c.textSubtle,
                          fontSize: 11,
                        }}
                      >
                        {remainingAttempts} attempt
                        {remainingAttempts !== 1 ? 's' : ''} remaining
                      </span>
                    </div>
                  )}

                {/* Error banner */}
                {error && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.22)',
                      borderRadius: 10,
                      padding: '9px 13px',
                      marginBottom: 12,
                      textAlign: 'left',
                    }}
                  >
                    <p style={{ color: '#fca5a5', fontSize: 12, margin: 0 }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Primary button */}
                <button
                  id="bv-primary-btn"
                  type="button"
                  className="bv-btn-primary"
                  onClick={submitHandler}
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: isLoading
                      ? 'rgba(134,93,245,0.5)'
                      : 'linear-gradient(90deg, #5a8bf7 0%, #865df5 100%)',
                    color: 'white',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '0.2px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 8px 20px rgba(134,93,245,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    transition: 'all 0.2s',
                  }}
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="bv-spin"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="rgba(255,255,255,0.25)"
                          strokeWidth="3"
                        />
                        <path
                          d="M12 2a10 10 0 0110 10"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                      Processing…
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-90"
                      >
                        <rect
                          x="5"
                          y="11"
                          width="14"
                          height="10"
                          rx="2"
                          ry="2"
                        ></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      {mode === 'setup'
                        ? 'Create Password & Continue'
                        : 'Unlock Browser'}
                    </>
                  )}
                </button>

                {mode === 'unlock' && (
                  <div style={{ marginTop: 24, textAlign: 'center' }}>
                    {biometricsEnabled && (
                      <button
                        type="button"
                        onClick={handleBiometricUnlock}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#5a8bf7',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: '12px 16px',
                          borderRadius: 12,
                          width: '100%',
                          marginBottom: 20,
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) =>
                          (e.currentTarget.style.background = '#f1f5f9')
                        }
                        onMouseOut={(e) =>
                          (e.currentTarget.style.background = '#f8fafc')
                        }
                      >
                        Unlock with Biometrics (TouchID / Windows Hello)
                      </button>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 20,
                      }}
                    >
                      <div
                        style={{
                          height: 1,
                          flex: 1,
                          background: 'rgba(15,23,42,0.06)',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: '#94a3b8',
                          fontWeight: 500,
                        }}
                      >
                        or
                      </span>
                      <div
                        style={{
                          height: 1,
                          flex: 1,
                          background: 'rgba(15,23,42,0.06)',
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetForgotState();
                        setMode('forgot');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#5a8bf7',
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'color 0.2s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"></path>
                        <circle
                          cx="16.5"
                          cy="7.5"
                          r=".5"
                          fill="currentColor"
                        ></circle>
                      </svg>
                      Forgot password or PIN?
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Forgot mode (3-step OTP wizard) ── */}
            {mode === 'forgot' && (
              <div>
                {/* Step indicator dots */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 6,
                    marginBottom: 24,
                  }}
                >
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      style={{
                        width: forgotStep === step ? 20 : 6,
                        height: 6,
                        borderRadius: 3,
                        background:
                          forgotStep >= step
                            ? 'linear-gradient(90deg, #5a8bf7, #865df5)'
                            : 'rgba(15,23,42,0.1)',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </div>

                {/* ── Step 1: Send OTP ── */}
                {forgotStep === 1 && (
                  <div>
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #eff4ff 0%, #ede9fe 100%)',
                        border: '1px solid #c7d7ff',
                        borderRadius: 12,
                        padding: '14px 16px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#5a8bf7"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ marginTop: 1, flexShrink: 0 }}
                      >
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      <p
                        style={{
                          color: '#3730a3',
                          fontSize: 13,
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {noRecoveryEmail
                          ? 'No recovery email is configured. Please set one in Dashboard → Settings → Change Email, or use a backup code to unlock.'
                          : "We'll send a 6-digit recovery code to your registered recovery email."}
                      </p>
                    </div>

                    {error && (
                      <div
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 10,
                          padding: '9px 13px',
                          marginBottom: 14,
                        }}
                      >
                        <p
                          style={{ color: '#ef4444', fontSize: 12, margin: 0 }}
                        >
                          {error}
                        </p>
                      </div>
                    )}

                    {!noRecoveryEmail && (
                      <button
                        id="bv-send-otp-btn"
                        type="button"
                        onClick={handleSendForgotOtp}
                        disabled={isLoading}
                        style={{
                          width: '100%',
                          padding: '13px',
                          borderRadius: 12,
                          border: 'none',
                          background: isLoading
                            ? 'rgba(90,139,247,0.5)'
                            : 'linear-gradient(90deg, #5a8bf7 0%, #865df5 100%)',
                          color: 'white',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 16px rgba(90,139,247,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'all 0.2s',
                          marginBottom: 12,
                        }}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="bv-spin"
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth="3"
                              />
                              <path
                                d="M12 2a10 10 0 0110 10"
                                stroke="white"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            </svg>
                            Sending…
                          </>
                        ) : (
                          <>
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            Send Recovery Code
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* ── Step 2: Enter OTP ── */}
                {forgotStep === 2 && (
                  <div>
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: '1px solid #86efac',
                        borderRadius: 12,
                        padding: '12px 16px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p
                        style={{
                          color: '#15803d',
                          fontSize: 12,
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        Code sent to <strong>{maskedEmail}</strong>. Check your
                        inbox.
                      </p>
                    </div>

                    {/* OTP input */}
                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          color: c.textMuted,
                          fontWeight: 500,
                          marginBottom: 6,
                        }}
                      >
                        Enter 6-digit code
                      </label>
                      <input
                        id="bv-otp-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => {
                          setOtpInput(e.target.value.replace(/\D/g, ''));
                          clearError();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && otpInput.length === 6)
                            handleVerifyForgotOtp();
                        }}
                        placeholder="000000"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: c.inputBg,
                          border: `1px solid ${c.inputBorder}`,
                          borderRadius: 12,
                          padding: '14px 16px',
                          fontSize: 28,
                          fontWeight: 700,
                          letterSpacing: 12,
                          textAlign: 'center',
                          color: c.textMain,
                          fontFamily: 'monospace',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                        }}
                        autoFocus
                      />
                    </div>

                    {error && (
                      <div
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 10,
                          padding: '9px 13px',
                          marginBottom: 14,
                        }}
                      >
                        <p
                          style={{ color: '#ef4444', fontSize: 12, margin: 0 }}
                        >
                          {error}
                        </p>
                      </div>
                    )}

                    <button
                      id="bv-verify-otp-btn"
                      type="button"
                      onClick={handleVerifyForgotOtp}
                      disabled={otpInput.length !== 6 || isLoading}
                      style={{
                        width: '100%',
                        padding: '13px',
                        borderRadius: 12,
                        border: 'none',
                        background:
                          otpInput.length === 6 && !isLoading
                            ? 'linear-gradient(90deg, #5a8bf7 0%, #865df5 100%)'
                            : 'rgba(90,139,247,0.35)',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor:
                          otpInput.length === 6 && !isLoading
                            ? 'pointer'
                            : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        marginBottom: 10,
                      }}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="bv-spin"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="rgba(255,255,255,0.25)"
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
                        'Verify Code'
                      )}
                    </button>

                    {/* Resend link */}
                    <div style={{ textAlign: 'center' }}>
                      <button
                        id="bv-resend-otp-btn"
                        type="button"
                        onClick={() => {
                          setOtpInput('');
                          clearError();
                          handleSendForgotOtp();
                        }}
                        disabled={resendCooldown > 0 || isLoading}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: resendCooldown > 0 ? c.textSubtle : '#5a8bf7',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: resendCooldown > 0 ? 'default' : 'pointer',
                          padding: '4px 0',
                          transition: 'color 0.2s',
                        }}
                      >
                        {resendCooldown > 0
                          ? `Resend code in ${resendCooldown}s`
                          : 'Resend code'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Step 3: Set New Password ── */}
                {forgotStep === 3 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleResetPassword();
                    }}
                  >
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: '1px solid #86efac',
                        borderRadius: 12,
                        padding: '11px 14px',
                        marginBottom: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p style={{ color: '#15803d', fontSize: 12, margin: 0 }}>
                        Identity verified! Set your new master password.
                      </p>
                    </div>

                    <PasswordField
                      id="bv-new-password"
                      value={password}
                      onChange={(v) => {
                        setPassword(v);
                        clearError();
                      }}
                      onKeyEnter={handleResetPassword}
                      placeholder="New password (min. 6 characters)"
                      showPassword={showPassword}
                      onToggleShow={() => setShowPassword((v) => !v)}
                      autoFocus
                      styleVars={{
                        '--input-bg': c.inputBg,
                        '--input-border': c.inputBorder,
                        '--text-main': c.textMain,
                        '--icon-color': c.iconColor,
                      }}
                    />
                    <PasswordField
                      id="bv-confirm-new-password"
                      value={confirmPassword}
                      onChange={(v) => {
                        setConfirmPassword(v);
                        clearError();
                      }}
                      onKeyEnter={handleResetPassword}
                      placeholder="Confirm new password"
                      showPassword={showPassword}
                      onToggleShow={() => setShowPassword((v) => !v)}
                      styleVars={{
                        '--input-bg': c.inputBg,
                        '--input-border': c.inputBorder,
                        '--text-main': c.textMain,
                        '--icon-color': c.iconColor,
                      }}
                    />

                    {error && (
                      <div
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 10,
                          padding: '9px 13px',
                          marginBottom: 12,
                        }}
                      >
                        <p
                          style={{ color: '#ef4444', fontSize: 12, margin: 0 }}
                        >
                          {error}
                        </p>
                      </div>
                    )}

                    <button
                      id="bv-reset-password-btn"
                      type="submit"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        padding: '13px',
                        borderRadius: 12,
                        border: 'none',
                        background: isLoading
                          ? 'rgba(109,40,217,0.5)'
                          : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                        color: 'white',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 18px rgba(109,40,217,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        marginBottom: 12,
                      }}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="bv-spin"
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth="3"
                            />
                            <path
                              d="M12 2a10 10 0 0110 10"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          </svg>
                          Saving…
                        </>
                      ) : (
                        'Set New Password'
                      )}
                    </button>
                  </form>
                )}

                {/* Back button (all steps) */}
                <button
                  id="bv-back-to-unlock-btn"
                  type="button"
                  onClick={() => {
                    resetForgotState();
                    setMode('unlock');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 12,
                    background: 'transparent',
                    border: `1px solid ${c.inputBorder}`,
                    color: c.textSubtle,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    marginTop: 4,
                  }}
                >
                  ← Back to Unlock
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Developer Credit Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 13,
            color: c.textSubtle,
            fontWeight: 500,
          }}
        >
          Developed by{' '}
          <a
            href="https://rijoan.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#5a8bf7',
              textDecoration: 'none',
              fontWeight: 600,
              transition: 'opacity 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Md Rijoan Maruf
          </a>
        </div>
      </div>
    </>
  );
}
