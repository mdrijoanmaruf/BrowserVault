/**
 * AdvancedPage — Day 18
 *
 * Settings for Schedule, Shortcuts, Per-Profile, Domain Lock
 */

export function AdvancedPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white">Advanced Security</h2>
          <p className="text-sm text-white/40 mt-0.5">Schedule locks, configure shortcuts, and set domain rules.</p>
        </div>
        
        <div className="divide-y divide-white/[0.05]">
          {/* Scheduled Lock */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-white">Scheduled Lock</h3>
            <p className="text-xs text-white/40 mt-1 mb-4 leading-relaxed">
              Automatically lock the browser at a specific time every day.
            </p>
            <div className="flex items-center gap-3">
              <input type="time" className="bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400/50" />
              <button className="bg-white/[0.07] hover:bg-white/12 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Set Schedule
              </button>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <div>
              <h3 className="text-sm font-medium text-white">Keyboard Shortcuts</h3>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">
                Configure the Panic Lock shortcut (default: Ctrl+Shift+K).
              </p>
            </div>
            <button
              onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
              className="bg-white/[0.07] hover:bg-white/12 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
            >
              Configure in Chrome
            </button>
          </div>

          {/* Domain Lock List */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-medium text-white">Restricted Domains</h3>
            <p className="text-xs text-white/40 mt-1 mb-4 leading-relaxed">
              Always lock the browser when visiting these specific websites.
            </p>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="e.g. facebook.com" className="flex-1 max-w-xs bg-white/[0.07] border border-white/15 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400/50" />
              <button className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                Add Domain
              </button>
            </div>
            {/* Placeholder list */}
            <div className="mt-4 bg-black/20 border border-white/5 rounded-lg p-3">
              <p className="text-xs text-white/30 text-center italic">No domains restricted yet.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
