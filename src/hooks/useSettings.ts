import { useState, useEffect, useCallback } from 'react';
import type { UserSettings } from '@/types';
import { DEFAULT_USER_SETTINGS, STORAGE_KEYS } from '@/lib/constants';

export interface UseSettingsReturn {
  settings: UserSettings;
  isLoading: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
}

function storageGet<T>(key: string): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(result[key] !== undefined ? (result[key] as T) : null);
    });
  });
}

function storageSet<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => resolve());
  });
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount — read directly from chrome.storage.local
  useEffect(() => {
    (async () => {
      try {
        const stored = await storageGet<Partial<UserSettings>>(
          STORAGE_KEYS.SETTINGS
        );
        if (stored) {
          setSettings({ ...DEFAULT_USER_SETTINGS, ...stored });
        }
      } catch {
        // Use defaults silently
      } finally {
        setIsLoading(false);
      }
    })();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[STORAGE_KEYS.SETTINGS]) {
        const newVal =
          (changes[STORAGE_KEYS.SETTINGS].newValue as Partial<UserSettings>) ||
          {};
        setSettings((prev) => ({ ...prev, ...newVal }));
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next); // Optimistic update

      try {
        // Write directly to storage — no SW needed
        await storageSet<UserSettings>(STORAGE_KEYS.SETTINGS, next);

        const changes = Object.keys(patch).join(', ');
        try {
          const { logActivity } = await import('@/lib/activityLog');
          await logActivity('SETTINGS_CHANGE', `Updated: ${changes}`);
        } catch (err) {
          console.error('Failed to log activity:', err);
        }

        chrome.runtime.sendMessage(
          { action: 'UPDATE_SETTINGS', payload: patch },
          () => {
            void chrome.runtime.lastError; // consume error silently
          }
        );
      } catch {
        // Revert optimistic update on failure
        setSettings(settings);
      }
    },
    [settings]
  );

  return { settings, isLoading, updateSettings };
}
