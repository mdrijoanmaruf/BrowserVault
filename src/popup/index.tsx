import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../globals.css';
import { Popup } from './Popup';

createRoot(document.getElementById('popup-root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>
);
