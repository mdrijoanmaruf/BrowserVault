/**
 * Content Script Entry — src/content/index.ts
 *
 * Runs on every page (document_idle). On load it checks whether the
 * browser is currently locked; if so it shows the overlay immediately.
 *
 * It also listens for SHOW_LOCK_OVERLAY / HIDE_LOCK_OVERLAY messages
 * from the background service worker (sent by lockController.ts).
 */

import { showOverlay, hideOverlay } from './lockOverlay';

// ── Types ──────────────────────────────────────────────────────

interface StateMessage {
  data?: {
    lockState?: { isLocked?: boolean };
  };
}

interface RuntimeMessage {
  action?: string;
}

// ── On-load state check ────────────────────────────────────────

(async () => {
  try {
    const response = (await chrome.runtime.sendMessage({ action: 'GET_STATE' })) as StateMessage | undefined;
    if (response?.data?.lockState?.isLocked) {
      showOverlay();
    }
  } catch {
    // Service worker may not be awake yet; overlay will appear when
    // the background sends SHOW_LOCK_OVERLAY explicitly.
  }
})();

// ── Message listener ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
  if (message?.action === 'SHOW_LOCK_OVERLAY') {
    showOverlay();
  } else if (message?.action === 'HIDE_LOCK_OVERLAY') {
    hideOverlay();
  }
});
