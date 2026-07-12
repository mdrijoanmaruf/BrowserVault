/**
 * AdvancedPage — Day 18
 *
 * Settings for Schedule, Shortcuts, Per-Profile, Domain Lock
 */

import { useSettings } from '@/hooks/useSettings';
import { registerBiometrics, disableBiometrics } from '@/lib/webauthn';
import { useToast } from '@/components/ToastContext';
import Swal from 'sweetalert2';
import { useState } from 'react';
import { LuX } from 'react-icons/lu';

export function AdvancedPage() {
  const { settings, updateSettings } = useSettings();
  const { addToast } = useToast();
  const [newDomain, setNewDomain] = useState('');

  const handleFactoryReset = async () => {
    const result = await Swal.fire({
      title: 'Factory Reset',
      text: 'Are you sure you want to reset BrowserVault? This will remove your password and all settings.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, reset it!'
    });

    if (result.isConfirmed) {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'FACTORY_RESET' });
        if (response?.success) {
          await Swal.fire({
            title: 'Reset Complete',
            text: 'BrowserVault has been factory reset.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
          });
          window.location.reload();
        } else {
          Swal.fire('Error', response?.error || 'Failed to reset extension.', 'error');
        }
      } catch (err) {
        Swal.fire('Error', 'Failed to reset extension.', 'error');
      }
    }
  };

  const handleBiometricToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    
    if (checked) {
      const { success, error } = await registerBiometrics();
      
      if (success) {
        updateSettings({ biometricUnlockEnabled: true });
        addToast('Biometrics successfully registered!', 'success');
      } else {
        addToast(error || 'Failed to register biometrics.', 'error');
        // Revert UI toggle by updating settings with current false
        updateSettings({ biometricUnlockEnabled: false });
      }
    } else {
      await disableBiometrics();
      updateSettings({ biometricUnlockEnabled: false });
      addToast('Biometric unlock disabled.', 'info');
    }
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const domains = settings.restrictedDomains || [];
    if (!domains.includes(newDomain.trim())) {
      updateSettings({ restrictedDomains: [...domains, newDomain.trim()] });
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    const domains = settings.restrictedDomains || [];
    updateSettings({ restrictedDomains: domains.filter(d => d !== domain) });
  };
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden transition-colors duration-200">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Advanced Security</h2>
          <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">Schedule locks, configure shortcuts, and set domain rules.</p>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-white/[0.05] transition-colors duration-200">
          {/* Scheduled Lock */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Scheduled Lock</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 mb-4 leading-relaxed">
                Automatically lock the browser at a specific time every day.
              </p>
              <div className="flex items-center gap-3">
                <input 
                  type="time" 
                  value={settings.scheduledLockTime || '22:00'}
                  onChange={(e) => updateSettings({ scheduledLockTime: e.target.value })}
                  className="bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors disabled:opacity-50" 
                  disabled={!settings.scheduledLockEnabled}
                />
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.scheduledLockEnabled || false}
                onChange={(e) => updateSettings({ scheduledLockEnabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Shortcuts */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                Configure the Panic Lock shortcut (default: Ctrl+Shift+K).
              </p>
            </div>
            <button
              onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              className="bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            >
              Configure in Chrome
            </button>
          </div>

          {/* Auto-Lock on Sleep */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Auto-Lock on Sleep</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                Immediately lock the browser when your computer goes to sleep.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.autoLockOnSleep}
                onChange={(e) => updateSettings({ autoLockOnSleep: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Biometric Unlock */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-900 dark:text-white">Biometric Unlock (WebAuthn)</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                Use TouchID, FaceID, or Windows Hello to unlock the browser.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={settings.biometricUnlockEnabled}
                onChange={handleBiometricToggle}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-violet-600"></div>
            </label>
          </div>

          {/* Domain Lock List */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Restricted Domains</h3>
            <p className="text-xs text-slate-500 dark:text-white/40 mt-1 mb-4 leading-relaxed">
              Always lock the browser when visiting these specific websites.
            </p>
            <div className="flex items-center gap-3">
              <input 
                type="text" 
                placeholder="e.g. facebook.com" 
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                className="flex-1 max-w-xs bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors" 
              />
              <button 
                onClick={handleAddDomain}
                className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                Add Domain
              </button>
            </div>
            
            <div className="mt-4 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-lg p-3 transition-colors">
              {(!settings.restrictedDomains || settings.restrictedDomains.length === 0) ? (
                <p className="text-xs text-slate-400 dark:text-white/30 text-center italic">No domains restricted yet.</p>
              ) : (
                <ul className="space-y-2">
                  {settings.restrictedDomains.map(domain => (
                    <li key={domain} className="flex items-center justify-between bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded-md px-3 py-2">
                      <span className="text-sm text-slate-800 dark:text-white/90">{domain}</span>
                      <button 
                        onClick={() => handleRemoveDomain(domain)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Remove Domain"
                      >
                        <LuX size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          
          {/* Factory Reset */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Factory Reset</h3>
              <p className="text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                Delete all data, remove your password, and reset settings to default.
              </p>
            </div>
            <button
              onClick={handleFactoryReset}
              className="bg-red-50 dark:bg-red-500/15 hover:bg-red-100 dark:hover:bg-red-500/25 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            >
              Reset BrowserVault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
