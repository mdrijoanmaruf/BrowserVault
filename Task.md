# BrowserVault — 30-Day Detailed Development Plan

**Stack:** React + TypeScript + Tailwind CSS + Chrome Extension (Manifest V3)
**Bundler:** Vite + `@crxjs/vite-plugin`
**Storage:** `chrome.storage.local`
**Backend:** Lightweight serverless function (for OTP email dispatch only)

---

## 1. Project Folder Structure

```
browservault/
├── public/
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── manifest.json
│
├── src/
│   ├── background/
│   │   ├── index.ts                # Service worker entry
│   │   ├── idleWatcher.ts          # chrome.idle listener
│   │   ├── alarmScheduler.ts       # chrome.alarms for lock schedule
│   │   ├── messageRouter.ts        # Central message handler
│   │   └── lockController.ts       # Core lock/unlock logic
│   │
│   ├── content/
│   │   ├── lockOverlay.tsx         # Injected full-screen lock overlay
│   │   └── index.ts                # Content script entry
│   │
│   ├── popup/
│   │   ├── Popup.tsx
│   │   ├── index.tsx
│   │   └── components/
│   │       ├── LockButton.tsx
│   │       ├── QuickMenu.tsx
│   │       └── StatusBadge.tsx
│   │
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── index.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── DashboardLayout.tsx
│   │   └── pages/
│   │       ├── SettingsPage.tsx
│   │       ├── PasswordPage.tsx
│   │       ├── EmailPage.tsx
│   │       └── ActivityLogPage.tsx
│   │
│   ├── components/
│   │   ├── ui/                     # Button, Input, Toggle, Modal, Card, Dropdown
│   │   ├── LockScreen.tsx
│   │   ├── OtpInput.tsx
│   │   └── Toast.tsx
│   │
│   ├── lib/
│   │   ├── storage.ts              # chrome.storage.local wrapper
│   │   ├── crypto.ts               # Web Crypto hashing/salting
│   │   ├── otp.ts                  # OTP generation/validation helpers
│   │   ├── emailApi.ts             # Calls to email-sending backend
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSettings.ts
│   │   ├── useIdleTimer.ts
│   │   └── useActivityLog.ts
│   │
│   ├── context/
│   │   └── AppContext.tsx
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── styles/
│   │   └── globals.css
│   │
│   └── manifest.ts
│
├── backend/
│   ├── sendOtp.ts
│   └── config.ts
│
├── tests/
│   ├── unit/
│   └── e2e/
│
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── package.json
└── README.md
```

---

## 2. 30-Day Detailed Timeline

### **PHASE 1: Setup & Foundation (Days 1–4)**

#### **Day 1 — Project Initialization**

- Create project with `npm create vite@latest browservault -- --template react-ts`
- Install and configure Tailwind CSS (`tailwind.config.js`, `postcss.config.js`, add directives to `globals.css`)
- Install `@crxjs/vite-plugin` and configure `vite.config.ts` for Manifest V3 output
- Create `public/manifest.json` with base fields: `name`, `version`, `description`, `action`, `icons`
- Set up Git repository, `.gitignore`, and initial commit
- **Deliverable:** Extension loads as "unpacked" in Chrome with a blank popup

#### **Day 2 — Tooling & Code Quality Setup**

- Configure ESLint + Prettier with TypeScript rules
- Set up path aliases (`@/components`, `@/lib`, etc.) in `tsconfig.json` and `vite.config.ts`
- Install testing tools: Vitest for unit tests, Playwright (or Puppeteer) for e2e extension testing
- Set up `npm run` scripts: `dev`, `build`, `lint`, `test`
- Write `README.md` with setup instructions
- **Deliverable:** Clean dev environment with linting, formatting, and test runner working

#### **Day 3 — Type Definitions & Storage Layer**

- Define core TypeScript types in `types/index.ts`: `UserSettings`, `AuthState`, `ActivityLogEntry`, `LockState`, `ProfileConfig`
- Build `storage.ts`: typed wrapper functions `getItem<T>()`, `setItem<T>()`, `removeItem()` around `chrome.storage.local`
- Add default settings object (fallback values for first install)
- Write unit tests for storage wrapper (mock `chrome.storage` API)
- **Deliverable:** Fully typed, tested storage utility ready for use across the app

#### **Day 4 — Cryptography Utilities**

- Build `crypto.ts` using Web Crypto API (`SubtleCrypto`):
  - `hashPassword(password, salt)` using PBKDF2 or SHA-256 with salt
  - `generateSalt()`
  - `verifyPassword(input, storedHash, salt)`
- Build `otp.ts`: `generateOtp()` (6-digit), `isOtpExpired(timestamp)`, `validateOtp()`
- Write unit tests for hashing consistency and OTP expiry logic
- **Deliverable:** Secure password hashing and OTP utilities, fully unit tested

---

### **PHASE 2: Background Engine & Messaging (Days 5–7)**

#### **Day 5 — Service Worker Skeleton**

- Set up `background/index.ts` as the Manifest V3 service worker entry
- Implement `messageRouter.ts`: central handler for `chrome.runtime.onMessage` (action-based routing, e.g. `LOCK_BROWSER`, `UNLOCK_BROWSER`, `GET_STATE`)
- Implement basic in-memory + persisted lock state (`isLocked: boolean`) synced with storage
- Test service worker wake-up behavior and message round-trips using Chrome DevTools
- **Deliverable:** Working message-passing architecture between background, popup, and content scripts

#### **Day 6 — Lock Controller Logic**

- Build `lockController.ts`: core functions `lockBrowser()`, `unlockBrowser()`, `getLockStatus()`
- On `lockBrowser()`: broadcast message to all open tabs to inject the lock overlay
- On `unlockBrowser()`: verify password via `crypto.ts`, then broadcast "remove overlay" message
- Persist lock state across browser restarts (check state on service worker startup)
- **Deliverable:** Core lock/unlock logic working end-to-end via console-triggered messages

#### **Day 7 — Idle Detection Engine**

- Build `idleWatcher.ts` using `chrome.idle.onStateChanged` and `chrome.idle.setDetectionInterval()`
- Connect idle detection to settings (`idleModeEnabled`, `idleDurationMinutes`)
- When idle threshold is reached and idle mode is on, trigger `lockController.lockBrowser()`
- Write basic tests/manual verification using simulated idle state
- **Deliverable:** Browser auto-locks after configured idle duration

---

### **PHASE 3: Lock Screen & Popup (Days 8–11)**

#### **Day 8 — Lock Screen UI Component**

- Build `LockScreen.tsx`: full-screen overlay with centered card, password input, unlock button, app logo
- Style with Tailwind: backdrop blur, dark overlay, smooth fade-in animation
- Add "Forgot Password?" link on the lock screen (routes to recovery flow)
- Add clock/date display on lock screen for polish
- **Deliverable:** Standalone, styled lock screen component (Storybook-style isolated preview)

#### **Day 9 — Content Script Injection**

- Build `content/index.ts` and `lockOverlay.tsx` to mount the `LockScreen` React component into any active tab via a Shadow DOM (to avoid CSS conflicts with host page)
- Wire content script to listen for `SHOW_LOCK_OVERLAY` / `HIDE_LOCK_OVERLAY` messages from background
- Test injection across multiple tab types (regular pages, `chrome://` restrictions handling)
- **Deliverable:** Lock screen correctly overlays any active browser tab on command

#### **Day 10 — Password Verification & First-Time Setup**

- Build first-time setup flow: if no password exists in storage, show "Create Password" screen instead of lock screen
- Implement password confirmation input (enter twice) with match validation
- Wire `LockScreen.tsx` submit button to call `crypto.verifyPassword()` via background message
- On success: hide overlay, log unlock event; on failure: shake animation + error message
- **Deliverable:** Full working create-password + unlock cycle

#### **Day 11 — Popup UI**

- Build `Popup.tsx` as the extension's toolbar entry point
- Build `LockButton.tsx` — prominent "Lock Browser" button, triggers `lockController.lockBrowser()`
- Build `StatusBadge.tsx` — shows current state (Unlocked / Locked / Idle in X min)
- Build `QuickMenu.tsx` — dropdown/icons for Settings (opens dashboard tab) and Other Settings (theme, help link, version info)
- **Deliverable:** Fully functional popup connected to background lock state

---

### **PHASE 4: Failed Attempts, Cooldown & Notifications (Days 12–14)**

#### **Day 12 — Maximum Attempts Logic**

- Add `maxAttempts` field to settings (configurable number, e.g. 3/5/10)
- Track `failedAttemptCount` in storage, incremented on each wrong password
- Reset counter to 0 on successful unlock
- Display remaining attempts on the lock screen ("2 attempts remaining")
- **Deliverable:** Attempt tracking fully wired to settings and lock screen UI

#### **Day 13 — Cooldown & Lockout Behavior**

- When `failedAttemptCount` reaches `maxAttempts`, trigger a cooldown period (configurable, e.g. 5 minutes)
- Build cooldown countdown UI on the lock screen (disable input, show timer)
- Persist cooldown `expiresAt` timestamp in storage so it survives popup/tab reloads
- Log lockout events to the activity log
- **Deliverable:** Full lockout-and-cooldown cycle working and tamper-resistant against reloads

#### **Day 14 — Notifications System**

- Implement "Notify Me Before Locking" using `chrome.notifications.create()`
- For idle mode: show a warning notification with countdown (e.g. "Locking in 30 seconds") before auto-lock fires
- For scheduled lock (later feature): same warning pattern
- Add notification preferences (enable/disable) to settings
- **Deliverable:** Pre-lock warning notifications working for idle-triggered locks

---

### **PHASE 5: Settings Dashboard — Core (Days 15–18)**

#### **Day 15 — Dashboard Shell & Sidebar Navigation**

- Build `DashboardLayout.tsx` with a left sidebar and main content area
- Build `Sidebar.tsx` with 3 nav items: **Settings**, **Change Password**, **Change Email** (active-state highlighting, icons)
- Set up simple client-side routing (React Router or state-based tab switching)
- Wire popup's "Settings" button to open the dashboard in a new browser tab
- **Deliverable:** Navigable dashboard shell with empty page placeholders

#### **Day 16 — Settings Page: Behavior Options**

- Build `SettingsPage.tsx` with sectioned cards (General, Lock Behavior, Data)
- Implement **Run in Background** toggle (keeps service worker persistent/reconnects on browser start)
- Implement **Start State** selector: Restore with History / Restore All Tabs / Open Blank Tab / Open Custom URL
- Implement **Clear History** option (manual "Clear Now" button + optional auto-clear-on-lock toggle)
- Persist all changes immediately to storage via `useSettings.ts` hook
- **Deliverable:** Core behavior settings fully functional and persisted

#### **Day 17 — Settings Page: Idle Mode, Max Attempts, Notifications**

- Add **Maximum Attempts** input (number stepper, range 1–10) to Settings page
- Add **Idle Mode** toggle + duration dropdown (1/5/10/15/30 min, custom option)
- Add **Notify Me Before Locking** toggle with configurable warning time (e.g. 10/30/60 sec before)
- Connect all fields live to `idleWatcher.ts` and `lockController.ts` behavior
- **Deliverable:** All originally-requested settings fully implemented and functional

#### **Day 18 — Extra Settings: Schedule, Shortcuts, Per-Profile, Domain Lock**

- Implement **Lock Schedule**: time-range picker, uses `chrome.alarms` to trigger lock at set times
- Implement **Panic Lock Shortcut** via `chrome.commands` (configurable in `manifest.json` + settings page link to Chrome's shortcut settings page)
- Implement **Per-Profile Lock Rules**: detect profile via `chrome.identity` or profile-specific storage partitioning; allow independent settings per profile
- Implement **Site/Domain Lock List**: add/remove domains, block access via `declarativeNetRequest` or content script check redirecting to lock screen
- **Deliverable:** All "New" advanced settings functional

---

### **PHASE 6: Dashboard Polish & Activity Log (Days 19–20)**

#### **Day 19 — Theme, Import/Export**

- Implement Dark/Light theme toggle using Tailwind `dark:` class strategy + `AppContext.tsx` for theme state
- Persist theme choice to storage; apply theme across popup, dashboard, and lock screen
- Build **Export Settings**: serialize settings (excluding password hash) to downloadable JSON file
- Build **Import Settings**: file picker + validation + merge into storage with confirmation prompt
- **Deliverable:** Theming system and settings backup/restore fully working

#### **Day 20 — Activity Log Page**

- Build `ActivityLogPage.tsx`: table/list view of events (lock, unlock, failed attempt, settings change, password change, email change)
- Build `useActivityLog.ts` hook: append-only log writer + reader from storage
- Add filters (by event type, date range) and pagination if log grows large
- Implement **auto-clear log after X days** setting, with a background cleanup routine
- **Deliverable:** Fully functional, filterable activity log with auto-retention policy

---

### **PHASE 7: Password, Email & OTP System (Days 21–25)**

#### **Day 21 — Change Password Flow**

- Build `PasswordPage.tsx`: current password field, new password field, confirm field
- Validate current password before allowing change (call `crypto.verifyPassword()`)
- Add password strength meter (weak/medium/strong based on length + character variety)
- On success: re-hash and store new password, log event, show success toast
- **Deliverable:** Secure password change flow, fully validated

#### **Day 22 — PIN & Backup Codes**

- Add optional **PIN setup** (4–6 digit) as a secondary quick-unlock method, stored hashed separately from password
- Update `LockScreen.tsx` to allow switching between Password/PIN input modes
- Generate **backup recovery codes** (e.g. 8 single-use codes) on first password setup, shown once with a "copy/download" option
- Store backup codes hashed; mark each as used once redeemed
- **Deliverable:** PIN unlock and backup code system implemented

#### **Day 23 — Email Backend Setup (OTP Dispatch Service)**

- Set up a serverless function (`backend/sendOtp.ts`) using Resend, SendGrid, or Firebase Functions
- Configure environment variables/secrets for the email service API key (`backend/config.ts`)
- Build a simple endpoint: receives `{ email, otp }`, sends a formatted email, returns success/failure
- Test email delivery manually with sample requests (Postman/curl)
- **Deliverable:** Working backend endpoint that sends OTP emails on request

#### **Day 24 — Forgot Password Flow**

- Build "Forgot Password" screen (accessible from lock screen): enter registered email → request OTP
- Call `emailApi.ts` → backend `sendOtp` → generate OTP via `otp.ts` → store OTP + expiry in `chrome.storage.local`
- Build `OtpInput.tsx`: 6 separate digit boxes with auto-focus advance and paste support
- On correct OTP entry: allow new password creation; on expired/wrong OTP: show appropriate error
- Implement resend cooldown (e.g. 60 seconds) and max resend attempts per session
- **Deliverable:** Full forgot-password-via-email-OTP flow working end-to-end

#### **Day 25 — Change Email Flow & First-Time Email Verification**

- Build `EmailPage.tsx`: current email display, "Change Email" button
- Require current password confirmation before allowing the change request
- Send OTP to the **new** email address, verify before committing the change to storage
- Implement first-time email verification during initial account setup (verify ownership before enabling recovery features)
- **Deliverable:** Change-email flow and first-time verification fully functional

---

### **PHASE 8: Advanced Security & UX Polish (Days 26–27)**

#### **Day 26 — Biometric Unlock (WebAuthn) & Auto-Lock Triggers**

- Implement optional biometric unlock using the WebAuthn API (`navigator.credentials`) where platform authenticators are available
- Add graceful fallback messaging when WebAuthn isn't supported on the device/browser
- Implement **auto-lock on system sleep/lid close** detection where feasible (via `chrome.idle` "locked" state or power event signals)
- **Deliverable:** Biometric unlock option and system-sleep auto-lock trigger implemented

#### **Day 27 — UI/UX Polish Pass**

- Audit and refine Tailwind styling consistency across popup, dashboard, and lock screen (spacing, typography, color tokens)
- Add smooth transitions: overlay fade, sidebar active indicator slide, toast slide-in/out
- Build `Toast.tsx` global notification system for success/error/info messages across the app
- Add loading skeletons/spinners for async actions (saving settings, sending OTP, verifying password)
- Run a full manual UI pass on both Light and Dark themes
- **Deliverable:** Polished, consistent UI across the entire extension

---

### **PHASE 9: Testing, Security Review & Launch (Days 28–30)**

#### **Day 28 — Comprehensive Testing**

- Write unit tests for: password hashing/verification, OTP generation/expiry, idle timer logic, cooldown logic, storage wrapper
- Write integration tests for: full lock → unlock cycle, forgot password flow, change email flow
- Manual QA checklist: test all settings combinations together (idle + schedule + notifications + max attempts)
- Test edge cases: browser restart while locked, multiple tabs during lock, extension update while locked, storage quota edge cases
- Fix all bugs discovered during this pass
- **Deliverable:** Test suite passing, major bugs resolved, QA checklist signed off

#### **Day 29 — Security Review & Hardening**

- Confirm passwords/PINs are never stored or logged in plain text anywhere (including console logs and error messages)
- Confirm OTPs are not exposed in logs, and expire correctly server-side and client-side
- Review `manifest.json` permissions — remove anything overly broad or unused (principle of least privilege)
- Review content script injection for XSS risk (Shadow DOM isolation, sanitized inputs)
- Review backend endpoint for rate-limiting and basic abuse protection (prevent OTP spam)
- **Deliverable:** Security review completed with hardening fixes applied

#### **Day 30 — Packaging & Chrome Web Store Submission**

- Finalize icon set (16/48/128px) and promotional graphics (1280x800 screenshots, small promo tile)
- Write Chrome Web Store listing: short description, detailed description (repurpose feature list), category, privacy practices disclosure
- Write a clear **Privacy Policy** page (required — discloses local storage use and OTP email transmission)
- Build production bundle (`npm run build`), do a final manual test as an unpacked extension
- Package as `.zip`, submit to Chrome Web Store Developer Dashboard
- Tag release `v1.0.0` in Git, write release notes
- **Deliverable:** BrowserVault submitted to the Chrome Web Store for review

---

## 3. Notes & Recommendations

- **Realistic pacing:** 30 days assumes near-full-time focus. Part-time (2–3 hrs/day) developers should expect 45–60 days for the same scope.
- **Backend first:** Since Days 23–25 depend on a working OTP email backend, consider standing up a basic version of `sendOtp.ts` earlier (even as a stub) so email-dependent UI isn't blocked.
- **Chrome Web Store review time:** Review can take anywhere from a few days to a couple of weeks — this is separate from the 30-day build timeline, so plan launch dates accordingly.
- **MVP vs Full Scope:** If you need a faster launch, consider shipping an MVP after Day 20 (core lock, settings, password change) and pushing OTP/email recovery + biometric features as a v1.1 update.
- **Testing throughout:** Don't wait until Day 28 to test — write tests incrementally as each feature lands (the plan above front-loads utility tests on Days 3–4, but ongoing testing is still recommended per phase).
