export const storage = {
  async getItem<T>(key: string, defaultValue?: T): Promise<T | null> {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            console.error(
              '[BrowserVault] Storage error:',
              chrome.runtime.lastError
            );
            resolve(defaultValue !== undefined ? defaultValue : null);
            return;
          }
          if (result && result[key] !== undefined) {
            resolve(result[key] as T);
          } else {
            resolve(defaultValue !== undefined ? defaultValue : null);
          }
        });
      });
    } else {
      // Fallback for tests or non-extension environments if needed
      return Promise.resolve(defaultValue !== undefined ? defaultValue : null);
    }
  },

  async setItem<T>(key: string, value: T): Promise<void> {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve();
        });
      });
    } else {
      return Promise.resolve();
    }
  },

  async removeItem(key: string): Promise<void> {
    if (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, () => {
          resolve();
        });
      });
    } else {
      return Promise.resolve();
    }
  },
};
