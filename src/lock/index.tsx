/**
 * Lock Page Entry — src/lock/index.tsx
 *
 * Renders the LockScreen as a full-page app.
 * Opened when: a new tab is created while the browser is locked.
 * On unlock: redirects to the previous URL or chrome://newtab.
 */

import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { LockScreen } from '@/components/LockScreen';
import '@/globals.css';

function onHide() {
  // After successful unlock, check if there's a redirect URL
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect && redirect.startsWith('http')) {
    window.location.href = redirect;
  } else {
    // Go to new tab or close the lock tab
    window.location.href = 'chrome://newtab';
  }
}

// React to unlocks from other tabs
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['vault_lock_state']) {
    const lockState = changes['vault_lock_state'].newValue as { isLocked?: boolean } | undefined;
    if (lockState?.isLocked === false) {
      onHide();
    }
  }
});

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <LockScreen onHide={onHide} />
  </StrictMode>
);
