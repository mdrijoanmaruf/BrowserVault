import { useState } from 'react';
import { logActivity } from '@/lib/activityLog';
import { LuEye, LuEyeOff } from 'react-icons/lu';

export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setStatus({ type: 'error', msg: 'Please fill all fields.' });
      return;
    }
    
    if (newPassword.length < 6) {
      setStatus({ type: 'error', msg: 'Password must be at least 6 characters.' });
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
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-3xl overflow-hidden shadow-sm transition-colors duration-200 w-full">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">Change Vault Password</h2>
        <p className="text-[13px] text-slate-500 dark:text-white/40 mt-1 font-medium">Update the password used to unlock your browser.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div>
          <label className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2" htmlFor="current-pwd">
            Current Password
          </label>
          <div className="relative">
            <input
              id="current-pwd"
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[14px] font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              onClick={() => setShowCurrent(!showCurrent)}
            >
              {showCurrent ? <LuEyeOff size={18} /> : <LuEye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2" htmlFor="new-pwd">
            New Password
          </label>
          <div className="relative">
            <input
              id="new-pwd"
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 6 chars)"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[14px] font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              onClick={() => setShowNew(!showNew)}
            >
              {showNew ? <LuEyeOff size={18} /> : <LuEye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[14px] font-semibold text-slate-900 dark:text-white/90 mb-2" htmlFor="confirm-pwd">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              id="confirm-pwd"
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full bg-white dark:bg-white/[0.07] border border-slate-200 dark:border-white/15 text-slate-800 dark:text-white text-[14px] font-medium rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-[#5b32f5] focus:ring-1 focus:ring-[#5b32f5] shadow-sm transition-colors placeholder-slate-400 dark:placeholder-white/20"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? <LuEyeOff size={18} /> : <LuEye size={18} />}
            </button>
          </div>
        </div>

        {status && (
          <div className={`p-4 rounded-xl text-[14px] font-semibold ${status.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
            {status.msg}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#5b32f5] hover:bg-[#4a26d4] focus:ring-2 focus:ring-[#5b32f5]/40 text-white px-5 py-3 rounded-xl text-[14px] font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isLoading ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
