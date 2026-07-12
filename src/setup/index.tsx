import React from 'react';
import ReactDOM from 'react-dom/client';
import { Setup } from './Setup.tsx';
import '@/globals.css';

ReactDOM.createRoot(document.getElementById('setup-root')!).render(
  <React.StrictMode>
    <Setup />
  </React.StrictMode>
);
