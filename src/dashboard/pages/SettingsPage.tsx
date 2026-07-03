/**
 * SettingsPage — Days 16 & 17
 *
 * Sections:
 *  — General Behaviour (Day 16): Run in Background, Start State, Clear History on Lock
 *  — Lock Behaviour (Day 17): Max Attempts, Idle Mode, Notify Before Lock
 *  — Data (Day 16): Export Settings, Import Settings, Manual Clear History
 */

import { useState, useRef } from 'react';
import type { UserSettings } from '@/types';
import { useSettings } from '@/hooks/useSettings';

// ─────────────────────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-white/40 mt-0.5">{description}</p>}
      </div>
      <div className="divide-y divide-white/[0.05]">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90">{label}</p>
        {description && <p className="text-xs text-white/38 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40
        ${checked ? 'bg-violet-600' : 'bg-white/15'}
      `}
    >
      <span className={`
        inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200
        ${checked ? 'translate-x-6' : 'translate-x-1'}
      `} />
    </button>
  );
}

function Select({ value, onChange, options, id }: {
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
      className="bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/25 cursor-pointer transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#1a1030]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumberStepper({ value, min, max, onChange, id }: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  id: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none transition-colors"
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
        className="w-14 text-center bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-2 py-1.5 focus:outline-none focus:border-violet-400/50"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none transition-colors"
      >
        +
      </button>
    </div>
  );
}

function ActionButton({ onClick, variant = 'secondary', children, id }: {
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
  id: string;
}) {
  const base = 'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0';
  const variants = {
    primary: 'bg-violet-600 hover:bg-violet-500 text-white focus:ring-violet-500/40',
    secondary: 'bg-white/[0.07] hover:bg-white/12 text-white/80 border border-white/10 focus:ring-white/20',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 focus:ring-red-500/30',
  };
  return (
    <button id={id} type="button" onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={`
      fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl
      border text-sm font-medium animate-[fadeInUp_0.3s_ease-out]
      ${type === 'success'
        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'
        : 'bg-red-500/15 border-red-500/25 text-red-300'}
    `}>
      {type === 'success'
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
      }
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 bg-white/[0.03] rounded-2xl border border-white/[0.06]" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* ── General Behaviour (Day 16) ── */}
      <SectionCard
        title="General Behaviour"
        description="Control how BrowserVault runs and starts."
      >
        <SettingRow
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
          label="Start State"
          description="What happens when the browser starts and the lock is lifted."
        >
          <Select
            id="select-start-state"
            value={settings.startState}
            onChange={(v) => handleUpdate({ startState: v as UserSettings['startState'] })}
            options={[
              { value: 'history', label: 'Restore with History' },
              { value: 'allTabs', label: 'Restore All Tabs' },
              { value: 'blank', label: 'Open Blank Tab' },
              { value: 'customUrl', label: 'Open Custom URL' },
            ]}
          />
        </SettingRow>

        {settings.startState === 'customUrl' && (
          <SettingRow label="Custom URL" description="The URL to open when unlocking.">
            <input
              id="input-custom-url"
              type="url"
              defaultValue={settings.customUrl ?? ''}
              onBlur={(e) => handleUpdate({ customUrl: e.target.value })}
              placeholder="https://example.com"
              className="w-56 bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400/50 placeholder-white/20"
            />
          </SettingRow>
        )}

        <SettingRow
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

      {/* ── Lock Behaviour (Days 16 & 17) ── */}
      <SectionCard
        title="Lock Behaviour"
        description="Configure idle detection, failed attempts, and notifications."
      >
        {/* Max attempts (Day 17) */}
        <SettingRow
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

        {/* Idle mode toggle (Day 17) */}
        <SettingRow
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
                { value: 1,  label: '1 minute' },
                { value: 5,  label: '5 minutes' },
                { value: 10, label: '10 minutes' },
                { value: 15, label: '15 minutes' },
                { value: 30, label: '30 minutes' },
                { value: 60, label: '1 hour' },
              ]}
            />
          </SettingRow>
        )}

        {/* Notify before lock (Day 17) */}
        <SettingRow
          label="Notify Before Locking"
          description="Show a desktop notification 30 seconds before the browser auto-locks."
        >
          <Toggle
            id="toggle-notify-before-lock"
            checked={settings.notifyBeforeLock}
            onChange={(v) => handleUpdate({ notifyBeforeLock: v })}
          />
        </SettingRow>

        {/* Theme */}
        <SettingRow label="Theme" description="Interface colour preference.">
          <Select
            id="select-theme"
            value={settings.theme}
            onChange={(v) => handleUpdate({ theme: v as UserSettings['theme'] })}
            options={[
              { value: 'system', label: 'System default' },
              { value: 'dark',   label: 'Dark' },
              { value: 'light',  label: 'Light' },
            ]}
          />
        </SettingRow>
      </SectionCard>

      {/* ── Data (Day 16) ── */}
      <SectionCard
        title="Data"
        description="Export, import, or clear your BrowserVault data."
      >
        <SettingRow
          label="Export Settings"
          description="Download your settings as a JSON file (password hash excluded)."
        >
          <ActionButton id="btn-export" onClick={handleExport}>
            Export JSON
          </ActionButton>
        </SettingRow>

        <SettingRow
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
            <ActionButton id="btn-import" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </ActionButton>
          </>
        </SettingRow>

        <SettingRow
          label="Clear Browser History"
          description="Permanently delete all browser history right now."
        >
          <ActionButton id="btn-clear-history" onClick={handleClearHistory} variant="danger">
            Clear Now
          </ActionButton>
        </SettingRow>
      </SectionCard>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Keyframe for toast animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
