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
      <div className="w-full rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 text-center transition-colors duration-200">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-red-600 dark:text-red-400">
              <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <p className="text-slate-500 dark:text-white/50 text-xs leading-relaxed">
          Browser is locked. Use the on-screen lock overlay to enter your password.
        </p>
      </div>
    );
  }

  return (
    <button
      id="bv-lock-btn"
      disabled={isLocked || isLoading}
      onClick={onClick}
      className={`
        w-full group relative flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm
        transition-all duration-300 overflow-hidden shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-[#0f0b22] focus:ring-violet-500
        ${isLocked 
          ? 'bg-slate-100 dark:bg-white/[0.03] text-slate-400 dark:text-white/20 cursor-not-allowed border border-slate-200 dark:border-white/[0.05]'
          : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-violet-900/30 dark:shadow-violet-900/40 hover:shadow-violet-900/50 hover:scale-[1.02]'}
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
