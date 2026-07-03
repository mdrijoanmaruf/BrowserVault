/**
 * LockButton — primary action button for the popup
 *
 * When unlocked: shows "Lock Browser Now"
 * When locked:   shows a disabled/locked state message
 */

interface LockButtonProps {
  isLocked: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function LockButton({ isLocked, isLoading, onClick }: LockButtonProps) {
  if (isLocked) {
    return (
      <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-red-400">
              <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <p className="text-white/50 text-xs leading-relaxed">
          Browser is locked. Use the on-screen lock overlay to enter your password.
        </p>
      </div>
    );
  }

  return (
    <button
      id="bv-lock-btn"
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={`
        w-full py-4 rounded-2xl flex items-center justify-center gap-3
        font-semibold text-white text-sm tracking-wide transition-all duration-200
        ${isLoading
          ? 'bg-violet-800/50 cursor-not-allowed'
          : 'bg-gradient-to-br from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 hover:-translate-y-0.5 active:translate-y-0'}
        shadow-lg shadow-purple-900/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40
      `}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
            <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          Locking…
        </>
      ) : (
        <>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
          </svg>
          Lock Browser Now
        </>
      )}
    </button>
  );
}
