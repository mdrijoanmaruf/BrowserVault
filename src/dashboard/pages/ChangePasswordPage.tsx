/**
 * ChangePasswordPage — Day 15 (Nav placeholder & basic form)
 */

import { useState } from 'react';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', msg: 'Please fill all fields.' });
      return;
    }
    if (newPassword.length < 8) {
      setStatus({ type: 'error', msg: 'New password must be at least 8 characters.' });
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
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden max-w-xl">
      <div className="px-6 py-5 border-b border-white/[0.06]">
        <h2 className="text-base font-semibold text-white">Change Vault Password</h2>
        <p className="text-sm text-white/40 mt-0.5">Update the password used to unlock your browser.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/90 mb-1.5" htmlFor="current-pwd">
            Current Password
          </label>
          <input
            id="current-pwd"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-1.5" htmlFor="new-pwd">
            New Password
          </label>
          <input
            id="new-pwd"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/90 mb-1.5" htmlFor="confirm-pwd">
            Confirm New Password
          </label>
          <input
            id="confirm-pwd"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-violet-400/50"
          />
        </div>

        {status && (
          <div className={`p-3 rounded-xl text-sm ${status.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
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
    </div>
  );
}
