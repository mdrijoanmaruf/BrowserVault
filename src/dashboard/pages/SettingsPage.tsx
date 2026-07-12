import { useState, useRef } from 'react';
import type { UserSettings } from '@/types';
import { useSettings } from '@/hooks/useSettings';
import {
  LuMonitor,
  LuRocket,
  LuTrash2,
  LuFingerprint,
  LuLock,
  LuBell,
  LuPalette,
  LuHistory,
  LuDownload,
  LuUpload,
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.07] rounded-3xl overflow-hidden mb-6 shadow-sm transition-colors duration-200">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-slate-500 dark:text-white/40 mt-1 font-medium">
            {description}
          </p>
        )}
      </div>
      <div className="divide-y divide-slate-50 dark:divide-white/[0.02] transition-colors duration-200">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  icon,
  children,
}: {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-8 py-5 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {icon && (
          <div className="w-11 h-11 bg-[#f4f1fe] dark:bg-violet-500/10 text-[#5b32f5] dark:text-violet-400 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-violet-100 dark:border-violet-500/20">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 dark:text-white/90">
            {label}
          </p>
          {description && (
            <p className="text-[12px] text-slate-500 dark:text-white/40 mt-0.5 leading-relaxed font-medium">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-[26px] w-[44px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#5b32f5]/40
        ${checked ? 'bg-[#5b32f5]' : 'bg-slate-200 dark:bg-white/15'}
      `}
    >
      <span
        className={`
        inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200
        ${checked ? 'translate-x-[20px]' : 'translate-x-[3px]'}
      `}
      />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
  id,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  id: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[13px] font-medium rounded-xl px-4 py-2 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] cursor-pointer transition-colors shadow-sm"
    >
      {options.map((o) => (
        <option
          key={o.value}
          value={o.value}
          className="bg-white dark:bg-[#1a1030] text-slate-900 dark:text-white font-medium"
        >
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
  id,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none transition-colors shadow-sm font-medium"
      >
        −
      </button>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-10 text-center bg-transparent border-none text-slate-900 dark:text-white text-[14px] font-semibold focus:outline-none focus:ring-0 p-0"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none transition-colors shadow-sm font-medium"
      >
        +
      </button>
    </div>
  );
}

function ActionButton({
  onClick,
  variant = 'secondary',
  children,
  id,
}: {
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
  id: string;
}) {
  const base =
    'px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 shadow-sm';
  const variants = {
    primary:
      'bg-[#5b32f5] hover:bg-[#4a26d4] text-white focus:ring-[#5b32f5]/40',
    secondary:
      'bg-white dark:bg-white/[0.07] hover:bg-slate-50 dark:hover:bg-white/12 text-slate-700 dark:text-white/80 border border-slate-200 dark:border-white/10 focus:ring-slate-300 dark:focus:ring-white/20',
    danger:
      'bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 focus:ring-red-500/30',
  };
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
}: {
  message: string;
  type: 'success' | 'error';
}) {
  return (
    <div
      className={`
      fixed bottom-8 right-8 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl
      border text-[14px] font-semibold animate-[fadeInUp_0.3s_ease-out]
      ${
        type === 'success'
          ? 'bg-[#f4f1fe] dark:bg-violet-500/15 border-violet-200 dark:border-violet-500/25 text-[#5b32f5] dark:text-violet-300'
          : 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-300'
      }
    `}
    >
      {type === 'success' ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )}
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUpdate(patch: Partial<UserSettings>) {
    try {
      await updateSettings(patch);
      showToast('Settings saved.');
    } catch {
      showToast('Failed to save settings.', 'error');
    }
  }

  // ── Export settings ──────────────────────────────────────
  function handleExport() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      settings,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `browservault-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Settings exported successfully.');
  }

  // ── Import settings ──────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { settings?: Partial<UserSettings> };
      if (!parsed.settings) throw new Error('Invalid file format');
      await updateSettings(parsed.settings);
      showToast('Settings imported successfully.');
    } catch {
      showToast('Invalid settings file. Please check and try again.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Clear browser history ────────────────────────────────
  async function handleClearHistory() {
    try {
      await chrome.history.deleteAll();
      showToast('Browser history cleared.');
    } catch {
      showToast('Could not clear history — check permissions.', 'error');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-64 bg-white/[0.03] rounded-3xl border border-white/[0.06]"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* ── General Behaviour ── */}
      <SectionCard
        title="General Behaviour"
        description="Control how BrowserVault runs and starts."
      >
        <SettingRow
          icon={<LuMonitor className="w-[22px] h-[22px]" />}
          label="Run in Background"
          description="Keep the service worker alive. Ensures idle detection and scheduled locks work even when no tabs are focused."
        >
          <Toggle
            id="toggle-run-in-background"
            checked={settings.runInBackground}
            onChange={(v) => handleUpdate({ runInBackground: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<LuRocket className="w-[22px] h-[22px]" />}
          label="Start State"
          description="What happens when the browser starts and the lock is lifted."
        >
          <Select
            id="select-start-state"
            value={settings.startState}
            onChange={(v) =>
              handleUpdate({ startState: v as UserSettings['startState'] })
            }
            options={[
              { value: 'history', label: 'Restore with History' },
              { value: 'allTabs', label: 'Restore All Tabs' },
              { value: 'blank', label: 'Open Blank Tab' },
              { value: 'customUrl', label: 'Open Custom URL' },
            ]}
          />
        </SettingRow>

        {settings.startState === 'customUrl' && (
          <SettingRow
            label="Custom URL"
            description="The URL to open when unlocking."
          >
            <input
              id="input-custom-url"
              type="url"
              defaultValue={settings.customUrl ?? ''}
              onBlur={(e) => handleUpdate({ customUrl: e.target.value })}
              placeholder="https://example.com"
              className="w-56 bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[13px] font-medium rounded-xl px-4 py-2 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
            />
          </SettingRow>
        )}

        <SettingRow
          icon={<LuTrash2 className="w-[22px] h-[22px]" />}
          label="Clear History on Lock"
          description="Automatically wipe browser history every time the browser locks."
        >
          <Toggle
            id="toggle-clear-history"
            checked={settings.clearHistoryOnLock}
            onChange={(v) => handleUpdate({ clearHistoryOnLock: v })}
          />
        </SettingRow>
      </SectionCard>

      {/* ── Lock Behaviour ── */}
      <SectionCard
        title="Lock Behaviour"
        description="Configure idle detection, failed attempts, and notifications."
      >
        <SettingRow
          icon={<LuFingerprint className="w-[22px] h-[22px]" />}
          label="Maximum Failed Attempts"
          description="Number of wrong password attempts allowed before a cooldown is triggered."
        >
          <NumberStepper
            id="stepper-max-attempts"
            value={settings.maxAttempts}
            min={1}
            max={10}
            onChange={(v) => handleUpdate({ maxAttempts: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<LuLock className="w-[22px] h-[22px]" />}
          label="Idle Auto-Lock"
          description="Automatically lock the browser when the system is idle."
        >
          <Toggle
            id="toggle-idle-mode"
            checked={settings.idleModeEnabled}
            onChange={(v) => handleUpdate({ idleModeEnabled: v })}
          />
        </SettingRow>

        {settings.idleModeEnabled && (
          <SettingRow
            label="Idle Duration"
            description="How long the system must be idle before locking."
          >
            <Select
              id="select-idle-duration"
              value={settings.idleDurationMinutes}
              onChange={(v) => handleUpdate({ idleDurationMinutes: Number(v) })}
              options={[
                { value: 1, label: '1 minute' },
                { value: 5, label: '5 minutes' },
                { value: 10, label: '10 minutes' },
                { value: 15, label: '15 minutes' },
                { value: 30, label: '30 minutes' },
                { value: 60, label: '1 hour' },
              ]}
            />
          </SettingRow>
        )}

        <SettingRow
          icon={<LuBell className="w-[22px] h-[22px]" />}
          label="Notify Before Locking"
          description="Show a desktop notification 30 seconds before the browser auto-locks."
        >
          <Toggle
            id="toggle-notify-before-lock"
            checked={settings.notifyBeforeLock}
            onChange={(v) => handleUpdate({ notifyBeforeLock: v })}
          />
        </SettingRow>

        <SettingRow
          icon={<LuPalette className="w-[22px] h-[22px]" />}
          label="Theme"
          description="Interface colour preference."
        >
          <Select
            id="select-theme"
            value={settings.theme}
            onChange={(v) =>
              handleUpdate({ theme: v as UserSettings['theme'] })
            }
            options={[
              { value: 'system', label: 'System default' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </SettingRow>
      </SectionCard>

      {/* ── Data ── */}
      <SectionCard
        title="Data & Storage"
        description="Export, import, or clear your BrowserVault data."
      >
        <SettingRow
          icon={<LuHistory className="w-[22px] h-[22px]" />}
          label="Log Retention"
          description="How long to keep activity logs before automatically deleting them."
        >
          <Select
            id="select-log-retention"
            value={settings.logRetentionDays}
            onChange={(v) => handleUpdate({ logRetentionDays: Number(v) })}
            options={[
              { value: 7, label: '7 days' },
              { value: 14, label: '14 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
              { value: 36500, label: 'Never delete' },
            ]}
          />
        </SettingRow>

        <SettingRow
          icon={<LuDownload className="w-[22px] h-[22px]" />}
          label="Export Settings"
          description="Download your settings as a JSON file (password hash excluded)."
        >
          <ActionButton id="btn-export" onClick={handleExport}>
            Export JSON
          </ActionButton>
        </SettingRow>

        <SettingRow
          icon={<LuUpload className="w-[22px] h-[22px]" />}
          label="Import Settings"
          description="Restore settings from a previously exported JSON file."
        >
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
              id="file-import-input"
            />
            <ActionButton
              id="btn-import"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </ActionButton>
          </>
        </SettingRow>

        <SettingRow
          icon={<LuTrash2 className="w-[22px] h-[22px] text-red-500" />}
          label="Clear Browser History"
          description="Permanently delete all browser history right now."
        >
          <ActionButton
            id="btn-clear-history"
            onClick={handleClearHistory}
            variant="danger"
          >
            Clear Now
          </ActionButton>
        </SettingRow>
      </SectionCard>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Keyframe for toast animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
