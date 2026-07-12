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
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, #ef4444 1.5px, transparent 0)',
            backgroundSize: '24px 24px',
            backgroundPosition: 'center center',
          }}
        ></div>

        <div className="relative w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 className="relative text-lg font-bold text-slate-900 mb-1.5">
          Browser is locked
        </h2>
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
      className="w-full group relative flex items-center justify-between p-3.5 rounded-[24px] bg-white border-2 border-[#eaf0fa] shadow-[0_4px_20px_-4px_rgba(90,139,247,0.05)] hover:border-[#d6e3f8] hover:shadow-[0_8px_24px_-4px_rgba(90,139,247,0.1)] transition-all duration-300 overflow-hidden"
    >
      <div className="flex items-center gap-3.5">
        {/* Icon Circle */}
        <div className="w-[56px] h-[56px] flex-shrink-0 flex items-center justify-center rounded-full bg-[#f0f5ff]">
          {isLoading ? (
            <svg
              className="animate-spin w-6 h-6 text-[#5a8bf7]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                strokeOpacity="0.25"
              />
              <path
                d="M12 2a10 10 0 0110 10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5a8bf7"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <circle cx="12" cy="16" r="1" fill="currentColor"></circle>
            </svg>
          )}
        </div>

        {/* Texts */}
        <div className="flex flex-col items-start text-left">
          <span className="text-[17px] font-bold text-[#0a1536] tracking-tight leading-tight mb-1">
            {isLoading ? 'Locking...' : 'Lock Browser Now'}
          </span>
          <span className="text-[12px] font-medium text-[#5a6a85] leading-[1.3]">
            Secure your browser and
            <br />
            protect your data
          </span>
        </div>
      </div>

      {/* Right Arrow Button */}
      <div className="w-[42px] h-[42px] flex-shrink-0 flex items-center justify-center rounded-full bg-[#5a8bf7] mr-0.5 group-hover:bg-[#4c7de3] group-hover:scale-105 transition-all duration-300 shadow-md shadow-[#5a8bf7]/30">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}
