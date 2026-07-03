/**
 * ChangePasswordPage — Day 15 (Nav placeholder & basic form)
 */

import { useState, useMemo } from 'react';
import { checkPasswordStrength } from '@/lib/crypto';
import { logActivity } from '@/lib/activityLog';

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = useMemo(() => checkPasswordStrength(password), [password]);
  
  if (!password) return null;

  const getBarStyle = (index: number) => {
    if (strength === 'weak' && index === 0) return 'bg-red-500';
    if (strength === 'medium' && index <= 1) return 'bg-amber-500';
    if (strength === 'strong' && index <= 2) return 'bg-emerald-500';
    return 'bg-slate-200 dark:bg-white/10';
  };

  const labels = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
  };
  const colors = {
    weak: 'text-red-600 dark:text-red-400',
    medium: 'text-amber-600 dark:text-amber-400',
    strong: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5 h-1.5">
        <div className={`flex-1 rounded-full transition-colors ${getBarStyle(0)}`} />
        <div className={`flex-1 rounded-full transition-colors ${getBarStyle(1)}`} />
        <div className={`flex-1 rounded-full transition-colors ${getBarStyle(2)}`} />
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-500 dark:text-white/40">Password strength:</span>
        <span className={`font-medium ${colors[strength]}`}>{labels[strength]}</span>
      </div>
    </div>
  );
}

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  
  const [pinPassword, setPinPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pinPassword || !newPin) {
      setPinStatus({ type: 'error', msg: 'Please fill all fields.' });
      return;
    }
    if (!newPin.match(/^\d{4,6}$/)) {
      setPinStatus({ type: 'error', msg: 'PIN must be 4 to 6 digits.' });
      return;
    }
    setIsLoading(true);
    setPinStatus(null);
    
    try {
      const unlockResp = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password: pinPassword },
      }) as { data?: { success?: boolean; cooldownActive?: boolean } } | undefined;

      if (!unlockResp?.data?.success) {
        if (unlockResp?.data?.cooldownActive) {
          setPinStatus({ type: 'error', msg: 'Too many attempts. Cooldown active.' });
        } else {
          setPinStatus({ type: 'error', msg: 'Incorrect current password.' });
        }
        setIsLoading(false);
        return;
      }

      const resp = await chrome.runtime.sendMessage({
        action: 'SET_PIN',
        payload: { pin: newPin }
      }) as { data?: { success?: boolean } } | undefined;

      if (resp?.data?.success) {
        setPinStatus({ type: 'success', msg: 'PIN setup successfully.' });
        setNewPin('');
        setPinPassword('');
        await logActivity('SETTINGS_CHANGE', 'PIN code updated');
      } else {
        setPinStatus({ type: 'error', msg: 'Failed to set PIN.' });
      }
    } catch {
      setPinStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', msg: 'Please fill all fields.' });
      return;
    }
    
    if (checkPasswordStrength(newPassword) === 'weak') {
      setStatus({ type: 'error', msg: 'Please choose a stronger password (at least 8 chars, mix of types).' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      // 1. Verify current password via UNLOCK_BROWSER
      const unlockResp = await chrome.runtime.sendMessage({
        action: 'UNLOCK_BROWSER',
        payload: { password: currentPassword },
      }) as { data?: { success?: boolean; cooldownActive?: boolean } } | undefined;

      if (!unlockResp?.data?.success) {
        if (unlockResp?.data?.cooldownActive) {
          setStatus({ type: 'error', msg: 'Too many attempts. Cooldown active.' });
        } else {
          setStatus({ type: 'error', msg: 'Incorrect current password.' });
        }
        setIsLoading(false);
        return;
      }

      // 2. Set new password
      const setResp = await chrome.runtime.sendMessage({
        action: 'SET_PASSWORD',
        payload: { password: newPassword },
      }) as { data?: { success?: boolean } } | undefined;

      if (setResp?.data?.success) {
        setStatus({ type: 'success', msg: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        
        await logActivity('PASSWORD_CHANGE');
      } else {
        setStatus({ type: 'error', msg: 'Failed to change password.' });
      }
    } catch {
      setStatus({ type: 'error', msg: 'Could not connect to service worker.' });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden max-w-xl transition-colors duration-200">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Change Vault Password</h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">Update the password used to unlock your browser.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="current-pwd">
            Current Password
          </label>
          <input
            id="current-pwd"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="new-pwd">
            New Password
          </label>
          <input
            id="new-pwd"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
          <PasswordStrengthMeter password={newPassword} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="confirm-pwd">
            Confirm New Password
          </label>
          <input
            id="confirm-pwd"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
        </div>

        {status && (
          <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
            {status.msg}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      <div className="px-6 py-5 border-t border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick Unlock PIN</h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">Set a 4 to 6 digit PIN as an alternative quick unlock method.</p>
      </div>

      <form onSubmit={handlePinSubmit} className="p-6 space-y-4 pt-0">
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="pin-pwd">
            Current Password
          </label>
          <input
            id="pin-pwd"
            type="password"
            value={pinPassword}
            onChange={(e) => setPinPassword(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="new-pin">
            New PIN (4-6 digits)
          </label>
          <input
            id="new-pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="w-full bg-white dark:bg-white/[0.07] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 transition-colors"
          />
        </div>

        {pinStatus && (
          <div className={`p-3 rounded-xl text-sm ${pinStatus.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
            {pinStatus.msg}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white/90 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Set PIN'}
          </button>
        </div>
      </form>
    </div>
  );
}
