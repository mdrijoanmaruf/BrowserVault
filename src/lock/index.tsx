import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { LockScreen } from '@/components/LockScreen';
import '@/globals.css';

async function onHide() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');

  if (redirect && !redirect.startsWith('chrome://')) {
    window.location.replace(redirect);
  } else {
    try {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) {
        await chrome.tabs.update(tab.id, {
          url: redirect || 'chrome://newtab/',
        });
      }
    } catch (err) {
      console.error('Failed to restore tab URL:', err);
    }
  }
}

// React to unlocks from other tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['vault_lock_state']) {
    const lockState = changes['vault_lock_state'].newValue as
      { isLocked?: boolean } | undefined;
    if (lockState?.isLocked === false) {
      onHide();
    }
  }
});

// ---------------------------------------------------------------------------
// Dedicated function to place cursor in the password field.
// Executes at the end of page load, window resize, fullscreen change, and OS focus.
// ---------------------------------------------------------------------------
export function ensurePasswordCursorFocused() {
  const doFocus = () => {
    const input = document.getElementById('bv-password') as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    try {
      const len = input.value.length;
      input.setSelectionRange(len, len);
    } catch {}
  };

  doFocus();
  requestAnimationFrame(() => {
    doFocus();
    setTimeout(doFocus, 50);
    setTimeout(doFocus, 150);
    setTimeout(doFocus, 400);
    setTimeout(doFocus, 800);
    setTimeout(doFocus, 1500);
  });
}

// Window & Document event triggers
window.addEventListener('focus', ensurePasswordCursorFocused);
window.addEventListener('resize', ensurePasswordCursorFocused);
document.addEventListener('fullscreenchange', ensurePasswordCursorFocused);
document.addEventListener('DOMContentLoaded', ensurePasswordCursorFocused);

// Request OS window focus via chrome.windows API
if (typeof chrome !== 'undefined' && chrome.windows) {
  chrome.windows.getCurrent((win) => {
    if (win && win.id) {
      chrome.windows.update(win.id, { focused: true }, () => {
        ensurePasswordCursorFocused();
      });
    }
  });
}

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <LockScreen onHide={onHide} />
  </StrictMode>
);

// Execute at the end after mounting
ensurePasswordCursorFocused();

