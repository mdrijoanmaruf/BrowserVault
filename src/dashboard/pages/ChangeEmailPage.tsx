/**
 * ChangeEmailPage — Day 15 (Nav placeholder & basic form)
 */

import { useState } from 'react';

export function ChangeEmailPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; msg: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setStatus({ type: 'error', msg: 'Please enter a valid email address.' });
      return;
    }
    
    // In Phase 5 we just mock this. Real verification happens later.
    setStatus({ type: 'success', msg: 'Recovery email updated successfully. (Mock)' });
    setEmail('');
  }

  return (
    <div className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden max-w-xl transition-colors duration-200">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] transition-colors duration-200">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recovery Email</h2>
        <p className="text-sm text-slate-500 dark:text-white/40 mt-0.5">Set an email address to recover your account if you forget your password.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-900 dark:text-white/90 mb-1.5" htmlFor="email-input">
            Email Address
          </label>
          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
            className="bg-slate-100 dark:bg-white/[0.07] hover:bg-slate-200 dark:hover:bg-white/12 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white/90 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/20"
          >
            Update Recovery Email
          </button>
        </div>
      </form>
    </div>
  );
}
