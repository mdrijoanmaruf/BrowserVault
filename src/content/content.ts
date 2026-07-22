import { showOverlay, hideOverlay } from './lockOverlay';

interface RuntimeMessage {
  action?: string;
}

const LOCK_STATE_KEY = 'vault_lock_state';

(async () => {
  try {
    // Read lock state directly from storage — reliable even when SW is dead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await new Promise<Record<string, any>>((resolve) => {
      chrome.storage.local.get([LOCK_STATE_KEY], (r) => resolve(r || {}));
    });
    const lockState = result[LOCK_STATE_KEY];
    if (lockState?.isLocked === true) {
      showOverlay();
    }
  } catch {
    // Silently ignore — extension context may not be ready
  }
})();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[LOCK_STATE_KEY]) {
    const lockState = changes[LOCK_STATE_KEY].newValue as
      { isLocked?: boolean } | undefined;
    if (lockState?.isLocked === true) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message?.action === 'SHOW_LOCK_OVERLAY') {
    showOverlay();
  } else if (message?.action === 'HIDE_LOCK_OVERLAY') {
    hideOverlay();
  } else if (message?.action === 'SHOW_LOCKED_ALERT') {
    alert('BrowserVault is Locked\n\nYou must unlock the browser before you can access the extension menu.');
  }
});
