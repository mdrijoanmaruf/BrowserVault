/**
 * QuickMenu — icon row in the popup footer
 *
 * Opens the Settings dashboard in a new tab (placeholder: index.html)
 * and shows version/help info.
 */

export function QuickMenu() {
  const openSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
  };

  return (
    <>
      <button
        id="bv-settings-btn"
        type="button"
        onClick={openSettings}
        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="text-slate-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div className="text-left flex flex-col">
            <span className="text-slate-800 text-[13px] font-bold">Settings</span>
            <span className="text-slate-500 text-[11px]">Customize your security preferences</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
          <path d="M9 18l6-6-6-6"></path>
        </svg>
      </button>

      <div className="flex justify-end pr-2 pt-1">
        <span className="text-slate-400 text-[11px] font-medium tracking-wide">v1.0.0</span>
      </div>
    </>
  );
}
