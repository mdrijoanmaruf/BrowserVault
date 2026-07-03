/**
 * LockScreen — Day 8
 *
 * Full-screen overlay rendered inside a Shadow DOM (content script) or
 * any other React tree. Uses inline styles exclusively so it is completely
 * self-contained and needs no external stylesheet.
 *
 * Modes:
 *  - "unlock"  → password input, verify via UNLOCK_BROWSER
 *  - "setup"   → first-time password creation (SET_PASSWORD + UNLOCK_BROWSER)
 *  - "forgot"  → recovery instructions placeholder
 */

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type LockMode = 'unlock' | 'setup' | 'forgot';

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
// Eye icons
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

// ─────────────────────────────────────────────────────────────
// Password field helper
// ─────────────────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onKeyEnter: () => void;
  placeholder: string;
  showPassword: boolean;
  onToggleShow: () => void;
  autoFocus?: boolean;
}

function PasswordField({ id, value, onChange, onKeyEnter, placeholder, showPassword, onToggleShow, autoFocus }: PasswordFieldProps) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <input
        id={id}
        className="bv-input"
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onKeyEnter(); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={id === 'bv-password' ? 'current-password' : 'new-password'}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: 12, padding: '12px 44px 12px 16px',
          color: 'white', fontSize: 14, transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />
      <button type="button" className="bv-eye" onClick={onToggleShow} tabIndex={-1}
        style={{
          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.35)', padding: 4,
          display: 'flex', alignItems: 'center', transition: 'color 0.2s',
        }}
      >
        {showPassword ? <EyeOffIcon /> : <EyeOnIcon />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shield logo
// ─────────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <div style={{
      width: 56, height: 56,
      background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      borderRadius: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 8px 24px rgba(124, 58, 237, 0.45), 0 0 0 1px rgba(167,139,250,0.15) inset',
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L4 6V12C4 16.8 7.6 21.1 12 22.5C16.4 21.1 20 16.8 20 12V6L12 2Z" fill="white" fillOpacity="0.95"/>
        <path d="M9 12.5L11 14.5L15 10.5" stroke="rgba(109,40,217,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
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

  // Check auth state on mount to pick mode
  useEffect(() => {
    (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' }) as
          { data?: { authState?: { hasPassword?: boolean } } } | undefined;
        if (response?.data?.authState?.hasPassword === false) {
          setMode('setup');
        }
      } catch {
        // Service worker may not be awake yet — default to unlock mode
      }
    })();
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

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
      }) as { data?: { success?: boolean; noPasswordSet?: boolean; failedAttemptCount?: number } } | undefined;

      const data = response?.data;
      if (data?.success) {
        onHide?.();
      } else if (data?.noPasswordSet) {
        setMode('setup');
      } else {
        const count = data?.failedAttemptCount ?? 0;
        setError(`Incorrect password — ${count} failed attempt${count !== 1 ? 's' : ''}.`);
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
      // Step 1: store the new password
      const setResp = await chrome.runtime.sendMessage({
        action: 'SET_PASSWORD',
        payload: { password },
      }) as { data?: { success?: boolean } } | undefined;

      if (!setResp?.data?.success) {
        setError('Failed to save password. Please try again.');
        return;
      }

      // Step 2: immediately unlock with the same password so the browser is in a clean state
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

  // Format clock
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const seconds = time.getSeconds().toString().padStart(2, '0');
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const modeTitle = mode === 'setup' ? 'Welcome to BrowserVault'
    : mode === 'forgot' ? 'Account Recovery'
    : 'BrowserVault';

  const modeSubtitle = mode === 'setup' ? 'Create a password to secure your browser'
    : mode === 'forgot' ? 'How to recover your account'
    : 'Your browser is locked';

  const submitHandler = mode === 'setup' ? handleSetup : handleUnlock;

  return (
    <>
      <style>{KEYFRAMES}</style>
      {/* ── Full-screen overlay ── */}
      <div style={{
        position: 'fixed', inset: 0,
        zIndex: 2147483647,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        overflow: 'hidden',
      }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(145deg, #0d0b1e 0%, #130828 45%, #0d0b1e 100%)',
        }} />

        {/* Animated blobs */}
        <div className="bv-blob-1" style={{
          position: 'absolute', top: '15%', left: '10%',
          width: 520, height: 520, borderRadius: '50%', filter: 'blur(80px)',
          background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)',
        }} />
        <div className="bv-blob-2" style={{
          position: 'absolute', bottom: '10%', right: '8%',
          width: 440, height: 440, borderRadius: '50%', filter: 'blur(80px)',
          background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 24px', textAlign: 'center' }}>
          {/* Clock */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0 }}>
              <span style={{ fontSize: 80, fontWeight: 200, color: 'white', letterSpacing: '-3px', lineHeight: 1 }}>
                {hours}:{minutes}
              </span>
              <span style={{ fontSize: 36, fontWeight: 200, color: 'rgba(255,255,255,0.45)', marginLeft: 6, letterSpacing: '-1px' }}>
                {seconds}
              </span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6, letterSpacing: '0.02em' }}>
              {dateStr}
            </div>
          </div>

          {/* Glassmorphism card */}
          <div className={`bv-card-enter${isShaking ? ' bv-shake' : ''}`} style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <ShieldIcon />
            </div>

            <h1 style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: '0 0 6px', letterSpacing: '-0.3px' }}>
              {modeTitle}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
              {modeSubtitle}
            </p>

            {/* ── Unlock / Setup forms ── */}
            {mode !== 'forgot' && (
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
                />

                {mode === 'setup' && (
                  <PasswordField
                    id="bv-confirm-password"
                    value={confirmPassword}
                    onChange={(v) => { setConfirmPassword(v); clearError(); }}
                    onKeyEnter={handleSetup}
                    placeholder="Confirm new password"
                    showPassword={showPassword}
                    onToggleShow={() => setShowPassword((v) => !v)}
                  />
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

            {/* ── Forgot password ── */}
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
