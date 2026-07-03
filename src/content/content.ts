/**
 * Content Script Entry — src/content/index.ts
 *
 * Runs on every page (document_idle). On load it reads isLocked DIRECTLY
 * from chrome.storage.local — no dependency on the SW being alive.
 *
 * Also listens for SHOW_LOCK_OVERLAY / HIDE_LOCK_OVERLAY messages from
 * the background service worker for real-time lock/unlock broadcasts.
 */

import { showOverlay, hideOverlay } from './lockOverlay';

interface RuntimeMessage {
  action?: string;
}

const LOCK_STATE_KEY = 'vault_lock_state';

// ── On-load state check (reads storage directly, SW-independent) ──

(async () => {
  try {
    // Read lock state directly from storage — reliable even when SW is dead
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

// ── Reactive state changes ────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[LOCK_STATE_KEY]) {
    const lockState = changes[LOCK_STATE_KEY].newValue as { isLocked?: boolean } | undefined;
    if (lockState?.isLocked === true) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }
});

// ── Message listener (for real-time SW broadcasts fallback) ───────────

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message?.action === 'SHOW_LOCK_OVERLAY') {
    showOverlay();
  } else if (message?.action === 'HIDE_LOCK_OVERLAY') {
    hideOverlay();
  }
});
