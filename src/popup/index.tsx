import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../globals.css';
import { Popup } from './Popup';
import { AppProvider } from '../components/AppContext';

createRoot(document.getElementById('popup-root')!).render(
  <StrictMode>
    <AppProvider>
      <Popup />
    </AppProvider>
  </StrictMode>
);
