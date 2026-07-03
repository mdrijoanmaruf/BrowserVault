/**
 * Dashboard Router — Day 15
 *
 * State-based router orchestrating the dashboard shell and pages.
 */

import { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import type { DashboardPage } from './Sidebar';

import { SettingsPage } from './pages/SettingsPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ChangeEmailPage } from './pages/ChangeEmailPage';
import { AdvancedPage } from './pages/AdvancedPage';

export function Dashboard() {
  const [activePage, setActivePage] = useState<DashboardPage>('settings');

  const pageTitles: Record<DashboardPage, { title: string; subtitle?: string }> = {
    'settings': {
      title: 'Settings',
      subtitle: 'Manage your BrowserVault configuration and data.'
    },
    'change-password': {
      title: 'Change Password',
      subtitle: 'Update your master unlock password.'
    },
    'change-email': {
      title: 'Recovery Email',
      subtitle: 'Set an email address for account recovery.'
    },
    'advanced': {
      title: 'Advanced',
      subtitle: 'Advanced security rules and scheduling.'
    },
    'activity-log': {
      title: 'Activity Log',
      subtitle: 'View recent lock events and security changes.'
    }
  };

  const renderPage = () => {
    switch (activePage) {
      case 'settings': return <SettingsPage />;
      case 'change-password': return <ChangePasswordPage />;
      case 'change-email': return <ChangeEmailPage />;
      case 'advanced': return <AdvancedPage />;
      case 'activity-log': 
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-white/5 bg-white/[0.02] rounded-2xl border-dashed">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white/20 mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <h3 className="text-white/80 font-medium mb-1">Activity Log</h3>
            <p className="text-white/40 text-sm">Coming in Phase 6.</p>
          </div>
        );
      default: return <SettingsPage />;
    }
  };

  const currentMeta = pageTitles[activePage];

  return (
    <DashboardLayout
      activePage={activePage}
      onNavigate={setActivePage}
      pageTitle={currentMeta.title}
      pageSubtitle={currentMeta.subtitle}
    >
      {renderPage()}
    </DashboardLayout>
  );
}
