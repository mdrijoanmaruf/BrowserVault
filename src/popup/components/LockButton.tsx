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
      <div className="w-full relative overflow-hidden rounded-[20px] bg-red-50/80 border border-red-100 p-8 text-center flex flex-col items-center justify-center">
        {/* Subtle dot pattern background */}
        <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #ef4444 1.5px, transparent 0)', backgroundSize: '24px 24px', backgroundPosition: 'center center' }}></div>
        
        <div className="relative w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="relative text-lg font-bold text-slate-900 mb-1.5">Browser is locked</h2>
        <p className="relative text-[13px] text-slate-500 max-w-[200px] leading-relaxed">
          Use the on-screen lock overlay to enter your password and unlock.
        </p>
      </div>
    );
  }

  return (
    <button
      id="bv-lock-btn"
      disabled={isLocked || isLoading}
      onClick={onClick}
      className="w-full group relative flex flex-col items-center justify-center py-7 rounded-[20px] bg-gradient-to-r from-[#5a8bf7] to-[#865df5] hover:scale-[1.01] hover:shadow-lg hover:shadow-[#865df5]/20 transition-all duration-300 text-white overflow-hidden"
    >
      <div className="flex items-center justify-center gap-3">
        {isLoading ? (
          <svg className="animate-spin w-8 h-8 opacity-90" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3"/>
            <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            <circle cx="12" cy="16" r="1" fill="currentColor"></circle>
          </svg>
        )}
        <span className="text-[22px] font-bold tracking-wide">
          {isLoading ? 'Locking...' : 'Lock Browser Now'}
        </span>
      </div>
      <span className="text-[13px] font-medium text-white/80 mt-1.5">
        Secure your browser and protect your data
      </span>
    </button>
  );
}
