import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { getActivityLog, clearActivityLog } from '@/lib/activityLog';
import type { ActivityLogEntry } from '@/types';

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit'
  });
}

function getIconForType(type: ActivityLogEntry['type']) {
  switch (type) {
    case 'LOCK':
      return (
        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
      );
    case 'UNLOCK':
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
          </svg>
        </div>
      );
    case 'FAILED_ATTEMPT':
      return (
        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
      );
    case 'SETTINGS_CHANGE':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
      );
    case 'PASSWORD_CHANGE':
    case 'EMAIL_CHANGE':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
      );
  }
}

function getTitleForType(type: ActivityLogEntry['type']) {
  switch (type) {
    case 'LOCK': return 'Browser Locked';
    case 'UNLOCK': return 'Browser Unlocked';
    case 'FAILED_ATTEMPT': return 'Failed Unlock Attempt';
    case 'SETTINGS_CHANGE': return 'Settings Updated';
    case 'PASSWORD_CHANGE': return 'Password Changed';
    case 'EMAIL_CHANGE': return 'Recovery Email Changed';
  }
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setIsLoading(true);
    const allLogs = await getActivityLog();
    // Sort descending by timestamp
    allLogs.sort((a, b) => b.timestamp - a.timestamp);
    setLogs(allLogs);
    setIsLoading(false);
  }

  async function handleClear() {
    const result = await Swal.fire({
      title: 'Clear Logs?',
      text: 'Are you sure you want to clear all activity logs?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, clear them!'
    });
    
    if (!result.isConfirmed) return;

    await clearActivityLog();
    await loadLogs();
    
    Swal.fire({
      title: 'Cleared!',
      text: 'Activity logs have been cleared.',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    });
  }

  const totalPages = Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));
  const currentLogs = logs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-white/50">
            View recent lock events and configuration changes.
          </p>
        </div>
        {logs.length > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
          >
            Clear Log
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden transition-colors duration-200">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 dark:text-white/40 text-sm">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-white/[0.05] rounded-full flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-400 dark:text-white/30">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-900 dark:text-white font-medium mb-1">No Activity Found</p>
            <p className="text-sm text-slate-500 dark:text-white/40">Events will appear here once you start using BrowserVault.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {currentLogs.map((entry) => (
                <div key={entry.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                  {getIconForType(entry.type)}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {getTitleForType(entry.type)}
                    </p>
                    {entry.details && (
                      <p className="text-xs text-slate-500 dark:text-white/50 mt-1">{entry.details}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-white/30 pt-1.5 whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-white/70 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500 dark:text-white/40">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-white/70 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
