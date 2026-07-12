import type { ReactNode } from 'react';
import type { DashboardPage } from './Sidebar';
import { Sidebar } from './Sidebar';
import { LuSettings, LuSlidersHorizontal, LuMoon, LuSun } from 'react-icons/lu';
import { useSettings } from '@/hooks/useSettings';

interface DashboardLayoutProps {
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
  children: ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
}

export function DashboardLayout({
  activePage,
  onNavigate,
  children,
  pageTitle,
  pageSubtitle,
}: DashboardLayoutProps) {
  const { settings, updateSettings } = useSettings();
  const toggleTheme = () => {
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };
  return (
    <div
      className="flex h-screen bg-slate-50 dark:bg-[#0d0b1e] text-slate-900 dark:text-white overflow-hidden transition-colors duration-200"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Decorative graphic (only on large screens) */}
        <div className="absolute top-0 right-0 w-[400px] h-[160px] pointer-events-none hidden md:block overflow-hidden">
          {/* Subtle dotted pattern */}
          <div
            className="absolute inset-0 opacity-20 dark:opacity-10"
            style={{
              backgroundImage: 'radial-gradient(#5b32f5 1px, transparent 1px)',
              backgroundSize: '16px 16px',
              maskImage:
                'radial-gradient(ellipse at top right, black 40%, transparent 70%)',
            }}
          ></div>

          {/* Floating elements mimicking the screenshot */}
          <div className="absolute top-4 right-16 w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-3xl rotate-12 flex items-center justify-center shadow-lg transform -translate-y-4 translate-x-4">
            <LuSettings className="w-12 h-12 text-blue-500 dark:text-blue-400 opacity-80" />
          </div>
          <div className="absolute top-8 right-8 w-28 h-20 bg-violet-600 rounded-2xl -rotate-6 flex items-center justify-center shadow-xl shadow-violet-500/20 z-10 border border-violet-500">
            <LuSlidersHorizontal className="w-10 h-10 text-white" />
          </div>

          {/* Small floating dots */}
          <div className="absolute top-20 right-40 w-3 h-3 bg-violet-300 rounded-full blur-[1px]"></div>
          <div className="absolute top-6 right-6 w-4 h-4 bg-blue-200 rounded-full blur-[1px]"></div>
          <div className="absolute top-24 right-4 w-5 h-5 bg-[#e0d4ff] rounded-full blur-[2px]"></div>
        </div>

        {/* Page header */}
        <div className="sticky top-0 z-50 bg-white/90 dark:bg-[#0d0b1e]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/[0.06] px-10 py-8 transition-colors duration-200 flex justify-between items-end">
          <div>
            <h1 className="text-[28px] font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p className="text-[15px] text-slate-500 dark:text-white/50 mt-2 font-medium">
                {pageSubtitle}
              </p>
            )}
          </div>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/80 transition-colors"
            title="Toggle Theme"
          >
            {settings.theme === 'dark' ? (
              <LuSun className="w-5 h-5" />
            ) : (
              <LuMoon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Page content */}
        <div className="px-10 py-8 w-full relative z-20">{children}</div>
      </main>
    </div>
  );
}
