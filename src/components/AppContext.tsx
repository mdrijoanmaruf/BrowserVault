/**
 * AppContext — Day 19
 *
 * Provides theme context to the app and automatically toggles the `.dark`
 * class on the HTML element based on UserSettings.
 */

import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSettings } from '@/hooks/useSettings';
import type { UserSettings } from '@/types';

interface AppContextValue {
  theme: UserSettings['theme'];
  resolvedTheme: 'light' | 'dark'; // 'system' resolved to actual active mode
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { settings, isLoading } = useSettings();

  const theme = settings.theme;
  const isSystemDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolvedTheme = theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  // Listen for system theme changes if set to 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = document.documentElement;
      if (mediaQuery.matches) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <AppContext.Provider value={{ theme, resolvedTheme, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppTheme must be used within an AppProvider');
  }
  return context;
}
