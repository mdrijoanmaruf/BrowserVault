import { storage } from '@/lib/storage';
import { STORAGE_KEYS, DEFAULT_USER_SETTINGS } from '@/lib/constants';
import { lockBrowser, getLockStatus } from './lockController';
import type { UserSettings } from '@/types';

export function startDomainWatcher() {
  chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url) {
      const url = tab.url;
      // Skip extensions pages
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://'))
        return;

      const settings =
        (await storage.getItem<UserSettings>(STORAGE_KEYS.SETTINGS)) ??
        DEFAULT_USER_SETTINGS;
      const restrictedDomains = settings.restrictedDomains || [];

      if (restrictedDomains.length === 0) return;

      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Check if hostname matches any restricted domain
        const isRestricted = restrictedDomains.some((domain) => {
          return hostname === domain || hostname.endsWith(`.${domain}`);
        });

        if (isRestricted) {
          const lockState = await getLockStatus();
          if (!lockState.isLocked) {
            console.log(
              `[BrowserVault] Restricted domain accessed: ${hostname}. Locking browser.`
            );
            await lockBrowser();
          }
        }
      } catch {
        // Invalid URL, ignore
      }
    }
  });
}
