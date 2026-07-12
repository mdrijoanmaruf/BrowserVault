

import { useState, useEffect, useCallback } from 'react';
import type { ActivityLogEntry } from '@/types';

export function useActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_ACTIVITY_LOG' }) as ActivityLogEntry[];
      setLogs(response || []);
    } catch {
      setError('Could not connect to service worker.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, isLoading, error, refreshLogs: fetchLogs };
}
