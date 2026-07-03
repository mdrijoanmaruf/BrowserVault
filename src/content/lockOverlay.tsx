/**
 * lockOverlay.tsx — Day 9
 *
 * Mounts the LockScreen React component into a Shadow DOM host element
 * appended to document.body. This fully isolates the overlay from the
 * host page's CSS/JS while allowing React to render normally inside.
 *
 * The shadow host itself is fixed full-screen so all children stack on top
 * of the page. When hidden, we remove the host from the DOM entirely.
 */

import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { LockScreen } from '@/components/LockScreen';

const HOST_ID = 'browservault-overlay-host';

let _root: Root | null = null;
let _host: HTMLElement | null = null;

function ensureHost(): { host: HTMLElement; shadow: ShadowRoot } {
  if (!_host) {
    _host = document.createElement('div');
    _host.id = HOST_ID;

    // The host is fixed + full-screen; children can use position:fixed or fill the host
    Object.assign(_host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'block',
      pointerEvents: 'auto',
    });

    document.body.appendChild(_host);
  }

  const existing = _host.shadowRoot;
  if (existing) {
    return { host: _host, shadow: existing };
  }

  const shadow = _host.attachShadow({ mode: 'open' });
  return { host: _host, shadow };
}

/** Renders the LockScreen overlay. No-op if already visible. */
export function showOverlay(): void {
  if (_root) return; // already mounted

  const { shadow } = ensureHost();

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  _root = createRoot(mountPoint);
  _root.render(
    <StrictMode>
      <LockScreen onHide={hideOverlay} />
    </StrictMode>
  );
}

/** Unmounts the LockScreen overlay and removes the host element. */
export function hideOverlay(): void {
  if (_root) {
    _root.unmount();
    _root = null;
  }
  if (_host) {
    _host.remove();
    _host = null;
  }
}
