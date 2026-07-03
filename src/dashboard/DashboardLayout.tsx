/**
 * DashboardLayout — Day 15
 *
 * Full-screen shell: sidebar on the left, scrollable main content on the right.
 */

import type { ReactNode } from 'react';
import type { DashboardPage } from './Sidebar';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  children: ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
}

export function DashboardLayout({ activePage, onNavigate, children, pageTitle, pageSubtitle }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-[#0d0b1e] text-white overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Page header */}
        <div className="sticky top-0 z-10 bg-[#0d0b1e]/95 backdrop-blur-sm border-b border-white/[0.06] px-8 py-5">
          <h1 className="text-xl font-bold text-white leading-none">{pageTitle}</h1>
          {pageSubtitle && (
            <p className="text-sm text-white/40 mt-1">{pageSubtitle}</p>
          )}
        </div>

        {/* Page content */}
        <div className="px-8 py-8 max-w-3xl">
          {children}
        </div>
      </main>
    </div>
  );
}
