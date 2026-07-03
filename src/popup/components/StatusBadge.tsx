/**
 * StatusBadge — shows Locked or Unlocked state with an animated indicator
 */

interface StatusBadgeProps {
  isLocked: boolean;
}

export function StatusBadge({ isLocked }: StatusBadgeProps) {
  return (
    <div className={`
      inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
      ${isLocked
        ? 'bg-red-500/15 text-red-400 border border-red-500/25'
        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'}
    `}>
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <span className={`
          animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
          ${isLocked ? 'bg-red-400' : 'bg-emerald-400'}
        `} />
        <span className={`
          relative inline-flex rounded-full h-2 w-2
          ${isLocked ? 'bg-red-400' : 'bg-emerald-400'}
        `} />
      </span>
      {isLocked ? 'Locked' : 'Unlocked'}
    </div>
  );
}
