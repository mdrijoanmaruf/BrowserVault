

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

    Object.assign(_host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      display: 'block',
      pointerEvents: 'auto',
    });

    if (document.body) {
      document.body.appendChild(_host);
    } else {
      document.documentElement.appendChild(_host);
    }
  }

  const existing = _host.shadowRoot;
  if (existing) {
    return { host: _host, shadow: existing };
  }

  const shadow = _host.attachShadow({ mode: 'open' });
  return { host: _host, shadow };
}

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
