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
import { ActivityLogPage } from './pages/ActivityLogPage';

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
      case 'activity-log': return <ActivityLogPage />;
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
