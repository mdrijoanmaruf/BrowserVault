import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { Dashboard } from './dashboard/Dashboard';
import { AppProvider } from './components/AppContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <Dashboard />
    </AppProvider>
  </StrictMode>
);
