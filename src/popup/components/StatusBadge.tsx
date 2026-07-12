interface StatusBadgeProps {
  isLocked: boolean;
}

export function StatusBadge({ isLocked }: StatusBadgeProps) {
  return (
    <div
      className={`
      flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider
      ${
        isLocked
          ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
          : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
      }
    `}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2">
        <span
          className={`
          animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
          ${isLocked ? 'bg-red-400' : 'bg-emerald-400'}
        `}
        />
        <span
          className={`
          relative inline-flex rounded-full h-2 w-2
          ${isLocked ? 'bg-red-400' : 'bg-emerald-400'}
        `}
        />
      </span>
      {isLocked ? 'Locked' : 'Unlocked'}
    </div>
  );
}
