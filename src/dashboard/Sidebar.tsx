import React from 'react';
import { LuSettings, LuKey, LuMail, LuShield, LuClock } from 'react-icons/lu';

export type DashboardPage =
  | 'settings'
  | 'change-password'
  | 'change-email'
  | 'advanced'
  | 'activity-log';

interface NavItem {
  id: DashboardPage;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface SidebarProps {
  activePage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'settings',         label: 'Settings',         icon: <LuSettings className="w-4 h-4" /> },
  { id: 'change-password',  label: 'Change Password',  icon: <LuKey className="w-4 h-4" /> },
  { id: 'change-email',     label: 'Change Email',     icon: <LuMail className="w-4 h-4" /> },
  { id: 'advanced',         label: 'Advanced',         icon: <LuShield className="w-4 h-4" />, badge: 'New' },
  { id: 'activity-log',     label: 'Activity Log',     icon: <LuClock className="w-4 h-4" /> },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-[#f8fafc] dark:bg-white/[0.03] border-r border-slate-200 dark:border-white/[0.07] h-full transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-8 border-b-0">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-600 rounded-full blur-sm opacity-20"></div>
          <img src={chrome.runtime.getURL('icons/icon128.png')} alt="BrowserVault Logo" className="w-10 h-10 flex-shrink-0 relative z-10" />
        </div>
        <div>
          <p className="text-[15px] font-bold text-slate-900 dark:text-white leading-none">BrowserVault</p>
          <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1 font-medium">Secure. Private. Yours.</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              id={`bv-nav-${item.id}`}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold
                transition-all duration-150 text-left group
                ${isActive
                  ? 'bg-[#f4f1fe] dark:bg-violet-600/20 text-[#5b32f5] dark:text-violet-300'
                  : 'text-[#64748b] dark:text-white/45 hover:text-slate-900 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]'}
              `}
            >
              <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-[#5b32f5] dark:text-violet-400' : 'text-[#94a3b8] dark:text-white/30 group-hover:text-slate-600 dark:group-hover:text-white/60'}`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ebe4ff] dark:bg-violet-500/20 text-[#5b32f5] dark:text-violet-300 font-bold tracking-wide">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Privacy Card */}
      <div className="px-4 pb-4">
        <div className="bg-white dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/10 rounded-2xl p-5 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ebe4ff] to-[#e0f2fe] opacity-50 dark:opacity-10"></div>
            <LuShield className="w-8 h-8 text-[#5b32f5] relative z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-sm z-20 flex items-center justify-center">
              <div className="w-1 h-1.5 border border-[#5b32f5] border-b-0 rounded-t-sm -mt-1"></div>
            </div>
          </div>
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-white mb-1">Your privacy, our priority</h3>
          <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed px-2">BrowserVault keeps your data safe and secure.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 flex items-center justify-center">
        <p className="text-slate-500 dark:text-white/30 text-[11px] font-semibold font-mono">v1.0.0</p>
      </div>
    </aside>
  );
}
