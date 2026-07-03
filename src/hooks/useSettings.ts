/**
 * useSettings — Day 16
 *
 * React hook that loads UserSettings from storage on mount and provides
 * an `updateSettings` function that persists changes immediately via
 * the BACKGROUND_UPDATE_SETTINGS message (updates both storage and
 * restarts the idleWatcher in the service worker).
 */

import { useState, useEffect, useCallback } from 'react';
import type { UserSettings } from '@/types';
import { DEFAULT_USER_SETTINGS } from '@/lib/constants';

export interface UseSettingsReturn {
  settings: UserSettings;
  isLoading: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_STATE' }) as
          { data?: { settings?: UserSettings } } | undefined;

        if (response?.data?.settings) {
          setSettings(response.data.settings);
        } else {
          // Fallback: read directly from storage
          const result = await chrome.storage.local.get('vault_settings');
          if (result['vault_settings']) {
            setSettings({ ...DEFAULT_USER_SETTINGS, ...(result['vault_settings'] as Partial<UserSettings>) });
          }
        }
      } catch {
        // Use defaults silently
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); // Optimistic update

    try {
      await chrome.runtime.sendMessage({ action: 'UPDATE_SETTINGS', payload: patch });
    } catch {
      // Revert on failure
      setSettings(settings);
    }
  }, [settings]);

  return { settings, isLoading, updateSettings };
}
