/**
 * LockScreen — Days 8 + 12 + 13
 *
 * Full-screen overlay rendered inside a Shadow DOM. Uses inline styles.
 *
 * Day 12: Shows "X attempts remaining" below the password field.
 * Day 13: When cooldown is active, hides the input and shows a live
 *         countdown timer until the cooldown expires.
 *
 * Modes:
 *  - "unlock"   → password input + attempts remaining
 *  - "setup"    → first-time password creation
 *  - "forgot"   → recovery instructions placeholder
 *  - "cooldown" → locked-out countdown screen
 */

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type LockMode = 'unlock' | 'setup' | 'forgot' | 'cooldown';

interface LockScreenProps {
  onHide?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

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
  .bv-input:focus {
    outline: none;
    border-color: rgba(167, 139, 250, 0.55) !important;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
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

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

function formatSeconds(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function EyeOffIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function EyeOnIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function PasswordField({
  id, value, onChange, onKeyEnter, placeholder, showPassword, onToggleShow, autoFocus, styleVars
}: {
  id: string; value: string; onChange: (v: string) => void; onKeyEnter: () => void;
  placeholder: string; showPassword: boolean; onToggleShow: () => void; autoFocus?: boolean;
  styleVars?: any;
}) {
  return (
    <div style={{ marginBottom: 16, ...styleVars }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'var(--input-bg, rgba(255, 255, 255, 0.05))',
        border: '1px solid var(--input-border, rgba(255, 255, 255, 0.15))',
        borderRadius: 12,
        padding: '0 16px',
        height: 48,
        transition: 'all 0.2s',
        color: 'var(--text-main, white)',
      }}>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onKeyEnter(); }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={id === 'bv-password' ? 'current-password' : 'new-password'}
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
            background: 'transparent', border: 'none', outline: 'none',
            padding: 4, cursor: 'pointer', color: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {showPassword ? <EyeOffIcon /> : <EyeOnIcon />}
        </button>
      </div>
    </div>
  );
}

/** Circular countdown ring for cooldown mode */
function CooldownRing({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, remainingMs / totalMs);
  const dashOffset = circumference * (1 - progress);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <div style={{ position: 'relative', width: 96, height: 96 }}>
        <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6"/>
          <circle
            cx="48" cy="48" r={radius} fill="none"
            stroke="url(#bvCooldownGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.5s linear' }}
          />
          <defs>
            <linearGradient id="bvCooldownGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444"/>
              <stop offset="100%" stopColor="#f97316"/>
            </linearGradient>
          </defs>
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatSeconds(remainingMs)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 1 }}>remaining</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function LockScreen({ onHide }: LockScreenProps) {
  const [mode, setMode] = useState<LockMode>('unlock');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [time, setTime] = useState(new Date());

  const [maxAttempts, setMaxAttempts] = useState(5);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const [cooldownExpiresAt, setCooldownExpiresAt] = useState<number | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const COOLDOWN_TOTAL_MS = 5 * 60 * 1000;

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' }) as
          {
            data?: {
              authState?: { hasPassword?: boolean };
              lockState?: { cooldownExpiresAt?: number | null; failedAttemptCount?: number };
              maxAttempts?: number;
              settings?: { theme?: 'light' | 'dark' | 'system' };
            }
          } | undefined;

        const data = response?.data;

        if (data?.settings?.theme) {
          const t = data.settings.theme;
          if (t === 'system') {
            const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(isDark ? 'dark' : 'light');
          } else {
            setTheme(t);
          }
        }

        if (data?.authState?.hasPassword === false) {
          setMode('setup');
          return;
        }

        if (data?.maxAttempts) {
          setMaxAttempts(data.maxAttempts);
          const failed = data.lockState?.failedAttemptCount ?? 0;
          setRemainingAttempts(data.maxAttempts - failed);
        }

        const expiresAt = data?.lockState?.cooldownExpiresAt;
        if (expiresAt && Date.now() < expiresAt) {
          setCooldownExpiresAt(expiresAt);
          setCooldownRemainingMs(expiresAt - Date.now());
          setMode('cooldown');
        }
      } catch {
        // Service worker may not be awake yet — default to unlock mode
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

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError('Please enter your password.');
      triggerShake();
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password },
      }) as {
        data?: {
          success?: boolean;
          noPasswordSet?: boolean;
          failedAttemptCount?: number;
          remainingAttempts?: number;
          cooldownActive?: boolean;
          cooldownExpiresAt?: number;
        }
      } | undefined;

      const data = response?.data;

      if (data?.success) {
        onHide?.();
      } else if (data?.noPasswordSet) {
        setMode('setup');
      } else if (data?.cooldownActive && data.cooldownExpiresAt) {
        setCooldownExpiresAt(data.cooldownExpiresAt);
        setCooldownRemainingMs(data.cooldownExpiresAt - Date.now());
        setMode('cooldown');
      } else {
        const remaining = data?.remainingAttempts ?? null;
        setRemainingAttempts(remaining);
        const msg = remaining !== null && remaining > 0
          ? `Incorrect password — ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Incorrect password.';
        setError(msg);
        triggerShake();
        setPassword('');
      }
    } catch {
      setError('Unable to reach the extension service. Try reloading the page.');
    } finally {
      setIsLoading(false);
    }
  }, [password, onHide, triggerShake]);

  const handleSetup = useCallback(async () => {
    if (!password) { setError('Please enter a password.'); triggerShake(); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); triggerShake(); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); triggerShake(); return; }

    setIsLoading(true);
    setError('');
    try {
      const setResp = await chrome.runtime.sendMessage({
        action: 'SET_PASSWORD',
        payload: { password },
      }) as { data?: { success?: boolean } } | undefined;

      if (!setResp?.data?.success) {
        setError('Failed to save password. Please try again.');
        return;
      }

      const unlockResp = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password },
      }) as { data?: { success?: boolean } } | undefined;

      if (unlockResp?.data?.success) {
        onHide?.();
      } else {
        setMode('unlock');
      }
    } catch {
      setError('Unable to reach the extension service. Try reloading the page.');
    } finally {
      setIsLoading(false);
    }
  }, [password, confirmPassword, onHide, triggerShake]);

  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const modeTitle =
    mode === 'setup' ? 'Welcome to BrowserVault'
    : mode === 'forgot' ? 'Account Recovery'
    : mode === 'cooldown' ? 'Too Many Failed Attempts'
    : 'BrowserVault';

  const modeSubtitle =
    mode === 'setup' ? 'Create a password to secure your browser'
    : mode === 'forgot' ? 'How to recover your account'
    : mode === 'cooldown' ? 'Please wait before trying again'
    : 'Your browser is locked';

  const submitHandler = mode === 'setup' ? handleSetup : handleUnlock;

  const isLight = theme === 'light';
  const c = {
    bg: isLight ? 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 45%, #f8fafc 100%)' : 'linear-gradient(145deg, #0d0b1e 0%, #130828 45%, #0d0b1e 100%)',
    bgCooldown: isLight ? 'linear-gradient(145deg, #fef2f2 0%, #fee2e2 45%, #fef2f2 100%)' : 'linear-gradient(145deg, #1a0a0a 0%, #200d0d 45%, #1a0a0a 100%)',
    textMain: isLight ? '#0f172a' : 'white',
    textMuted: isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.45)',
    textSubtle: isLight ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255,255,255,0.6)',
    glassBg: isLight ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.04)',
    glassBorder: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
    inputBg: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.05)',
    inputBorder: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)',
    iconBg: isLight ? 'linear-gradient(135deg, #8b5cf6, #c084fc)' : 'linear-gradient(135deg, #8b5cf6, #c084fc)',
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: 2147483647,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
        background: mode === 'cooldown' ? c.bgCooldown : c.bg,
      }}>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 24px', textAlign: 'center' }}>
          {/* Clock */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center' }}>
              <span style={{ fontSize: 80, fontWeight: 200, color: c.textMain, letterSpacing: '-3px', lineHeight: 1 }}>
                {hours}:{minutes}
              </span>
              <span style={{ fontSize: 36, fontWeight: 200, color: c.textMuted, marginLeft: 6, letterSpacing: '-1px' }}>
                {seconds}
              </span>
            </div>
            <div style={{ color: c.textSubtle, fontSize: 13, marginTop: 6, letterSpacing: '0.02em' }}>
              {dateStr}
            </div>
          </div>

          {/* Card */}
          <div className={`bv-card-enter${isShaking ? ' bv-shake' : ''}`} style={{
            background: c.glassBg,
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: `1px solid ${c.glassBorder}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                width: 56, height: 56,
                background: c.iconBg,
                borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45)',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L4 6V12C4 16.8 7.6 21.1 12 22.5C16.4 21.1 20 16.8 20 12V6L12 2Z" fill="white" />
                </svg>
              </div>
            </div>

            <h1 style={{ color: c.textMain, fontSize: 18, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              {modeTitle}
            </h1>
            <p style={{ color: c.textSubtle, fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
              {modeSubtitle}
            </p>

            {/* ── Cooldown mode ── */}
            {mode === 'cooldown' && (
              <>
                <CooldownRing remainingMs={cooldownRemainingMs} totalMs={COOLDOWN_TOTAL_MS} />
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <p style={{ color: c.textMuted, fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                    Too many failed attempts. Password entry is temporarily disabled to protect your data.
                    You can try again in <strong style={{ color: '#fca5a5' }}>{formatSeconds(cooldownRemainingMs)}</strong>.
                  </p>
                </div>
              </>
            )}

            {/* ── Unlock / Setup forms ── */}
            {(mode === 'unlock' || mode === 'setup') && (
              <>
                <PasswordField
                  id="bv-password"
                  value={password}
                  onChange={(v) => { setPassword(v); clearError(); }}
                  onKeyEnter={submitHandler}
                  placeholder={mode === 'setup' ? 'New password (min. 8 characters)' : 'Enter your password'}
                  showPassword={showPassword}
                  onToggleShow={() => setShowPassword((v) => !v)}
                  autoFocus
                  styleVars={{ '--input-bg': c.inputBg, '--input-border': c.inputBorder, '--text-main': c.textMain }}
                />

                {mode === 'setup' && (
                  <PasswordField
                    id="bv-confirm-password"
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); clearError(); }}
                    onKeyEnter={submitHandler}
                    placeholder="Confirm password"
                    showPassword={showPassword}
                    onToggleShow={() => setShowPassword((v) => !v)}
                    styleVars={{ '--input-bg': c.inputBg, '--input-border': c.inputBorder, '--text-main': c.textMain }}
                  />
                )}

                {/* Attempts remaining indicator */}
                {mode === 'unlock' && remainingAttempts !== null && remainingAttempts < maxAttempts && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    marginBottom: 10,
                  }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: maxAttempts }).map((_, i) => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: i < remainingAttempts
                            ? (remainingAttempts <= 1 ? '#ef4444' : remainingAttempts <= 2 ? '#f97316' : '#a78bfa')
                            : 'rgba(255,255,255,0.15)',
                        }} />
                      ))}
                    </div>
                    <span style={{
                      color: remainingAttempts <= 1 ? '#fca5a5' : remainingAttempts <= 2 ? '#fdba74' : c.textSubtle,
                      fontSize: 11,
                    }}>
                      {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                    </span>
                  </div>
                )}

                {/* Error banner */}
                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.22)',
                    borderRadius: 10, padding: '9px 13px', marginBottom: 12, textAlign: 'left',
                  }}>
                    <p style={{ color: '#fca5a5', fontSize: 12, margin: 0 }}>{error}</p>
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
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: isLoading ? 'rgba(109,40,217,0.5)' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                    color: 'white', fontSize: 14, fontWeight: 600, letterSpacing: '0.2px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 18px rgba(109,40,217,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  {isLoading ? (
                    <>
                      <svg className="bv-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
                        <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                      Processing…
                    </>
                  ) : mode === 'setup' ? 'Create Password & Continue' : 'Unlock Browser'}
                </button>

                {mode === 'unlock' && (
                  <button type="button" className="bv-link"
                    onClick={() => { setMode('forgot'); clearError(); }}
                    style={{
                      width: '100%', marginTop: 12, background: 'none', border: 'none',
                      color: 'rgba(255,255,255,0.32)', fontSize: 12, cursor: 'pointer',
                      transition: 'color 0.2s', padding: '4px 0',
                    }}
                  >
                    Forgot your password?
                  </button>
                )}
              </>
            )}

            {/* ── Forgot mode ── */}
            {mode === 'forgot' && (
              <>
                <div style={{
                  background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: 14, padding: '16px 20px', marginBottom: 16, textAlign: 'left',
                }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: 0, lineHeight: 1.65 }}>
                    Open the{' '}
                    <strong style={{ color: 'rgba(167,139,250,0.9)' }}>BrowserVault Settings</strong>
                    {' '}from the extension popup and use the{' '}
                    <strong style={{ color: 'rgba(167,139,250,0.9)' }}>Email Recovery</strong>
                    {' '}option to reset your password via a one-time code.
                  </p>
                </div>
                <button type="button" className="bv-btn-secondary"
                  onClick={() => setMode('unlock')}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.65)', fontSize: 14, cursor: 'pointer',
                    fontWeight: 500, transition: 'all 0.2s',
                  }}
                >
                  ← Back to Unlock
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
