<div align="center">
  <img src="public/icons/icon128.png" alt="BrowserVault Logo" width="128" height="128" />
  
  # BrowserVault
  **The Ultimate Security & Privacy Extension for Your Browser**

  <p align="center">
    <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000" />
    <img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
    <img alt="Chrome Extension" src="https://img.shields.io/badge/Platform-Chrome_Extension-4285F4?logo=googlechrome&logoColor=white" />
  </p>

  <p align="center">
    <a href="#">
      <img alt="Install on Chrome Web Store" src="https://img.shields.io/badge/Install%20BrowserVault-Chrome%20Web%20Store-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" />
    </a>
  </p>
</div>

---

**BrowserVault** is a comprehensive, feature-rich Chrome Extension designed to give you complete control over your browser's security. Whether you want to prevent unauthorized access to your browser, automatically lock specific websites, or wipe your browsing history during an emergency, BrowserVault has you covered.

Built with a beautiful, modern **Glassmorphism UI**, BrowserVault feels native, premium, and lightning fast.

## ✨ Key Features

### 🔒 Core Security
* **Master Password Protection:** Lock your entire browser behind a secure master password.
* **Biometric Unlock (WebAuthn):** Quickly and securely unlock your browser using your device's native fingerprint scanner (Touch ID, Windows Hello, etc.) or facial recognition.
* **Brute-Force Protection:** Intelligent cooldown timers activate after consecutive failed attempts to prevent unauthorized guessing.
* **Panic Lock:** Instantly lock your browser using a customizable keyboard shortcut (`Ctrl+Shift+K` / `Cmd+Shift+K`).

### ⚙️ Automation & Triggers
* **Startup Lock:** Automatically lock the browser the moment a new session begins.
* **Idle Auto-Lock:** Configure a custom timeout to automatically lock your browser when you step away from your device.
* **Domain Watcher (Restricted Websites):** Add specific domains (e.g., `whatsapp.com`, `gmail.com`). BrowserVault will instantly lock the browser or require a password whenever these restricted websites are accessed.
* **Scheduled Lock:** Set up automated locking schedules based on specific days of the week and times (e.g., lock every night at 11 PM).

### 🛡️ Privacy & Auditing
* **Clear History on Lock:** Optionally configure the extension to instantly wipe your recent browsing history whenever the browser is locked.
* **Activity Log:** A detailed, searchable log that records all security events, including:
  * Successful unlocks
  * Failed password attempts
  * Settings modifications (with old/new value tracking)
  * System locks (Panic, Idle, Domain, Scheduled)

### 🔑 Recovery & Backup
* **Email OTP Recovery:** Forgot your password? Securely reset it using a One-Time Password (OTP) sent to your configured recovery email.
* **Backup Codes:** Generate and safely store unique, one-time-use backup codes for emergency offline access.

### 🎨 Premium User Experience
* **Settings Dashboard:** A centralized, highly polished dashboard to manage security rules, domains, and advanced settings.
* **Quick Action Popup:** Click the extension icon to view your current security status or manually trigger a lock instantly.
* **Smooth Animations:** Built with micro-animations and a stunning light glassmorphism aesthetic for an unparalleled user experience.

---

## 🎛️ Dashboard Settings & Configuration

BrowserVault provides a comprehensive settings dashboard divided into specific modules to give you granular control over how the extension behaves.

### 1. General Behaviour
* **Run in Background:** Keeps the extension's service worker alive, ensuring Idle Auto-Lock and Scheduled Locks function perfectly even when no Chrome tabs are currently focused.
* **Start State:** Choose what happens when you successfully unlock the browser after a fresh startup. Options include:
  * Restore with History (Default)
  * Restore All Tabs
  * Open Blank Tab
  * Open Custom URL (Allows you to specify a precise URL to load upon unlock)
* **Clear History on Lock:** When enabled, BrowserVault will automatically wipe your recent browsing history the moment the browser locks, ensuring absolute privacy.

### 2. Lock Behaviour
* **Maximum Failed Attempts:** Configure the threshold (1 to 10 attempts) for incorrect passwords. Exceeding this limit triggers a secure 5-minute cooldown timer where password entry is disabled.
* **Idle Auto-Lock:** Automatically locks the browser when you step away.
* **Idle Duration:** Set the exact timeout period for the idle lock (1, 5, 10, 15, 30, or 60 minutes).
* **Notify Before Locking:** When enabled, Chrome will display a desktop notification 30 seconds before the idle timer expires, giving you a chance to interrupt the lock if you're still reading.
* **Theme:** Choose your preferred UI aesthetic (System Default, Light Mode, or Dark Mode).

### 3. Advanced Security
* **Scheduled Lock:** Enable automated locking and specify a precise time (e.g., 22:00) when the browser should enforce a lock every day.
* **Restricted Domains (Domain Watcher):** A powerful tool to build a custom blocklist (e.g., `whatsapp.com`, `mail.google.com`). Accessing any domain on this list will immediately trigger the lock screen, demanding your password.
* **Keyboard Shortcuts:** Quick access to configure the `Panic Lock` shortcut directly in Chrome's extension shortcuts menu (Default: `Ctrl+Shift+K`).
* **Factory Reset:** A secure reset mechanism that completely erases your master password, settings, and logs, returning the extension to a blank slate.

### 4. Data & Storage
* **Log Retention:** Control how long security events (Activity Logs) are kept before being automatically deleted. Options range from 7 days up to "Never Delete".
* **Export / Import Settings:** Easily export your precise configurations to a JSON file and import them on a different device to replicate your security setup.
* **Clear Browser History:** A manual panic button to instantly wipe all browser history directly from the dashboard.

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/BrowserVault.git
   cd BrowserVault
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```
   *(For active development with hot-reloading, run `npm run dev`)*

4. **Load into Chrome:**
   * Open Chrome and navigate to `chrome://extensions/`
   * Enable **Developer mode** in the top right corner.
   * Click **Load unpacked** and select the `dist` folder generated by the build step.

5. **Onboarding:**
   * Click the extension icon to launch the initial setup.
   * Create your Master Password, set up your Recovery Email, and configure Biometrics (optional).

---

## 🛠️ Tech Stack

* **Framework:** React 18, Vite
* **Language:** TypeScript
* **Styling:** Vanilla CSS & Tailwind styling patterns
* **Extension API:** Chrome Manifest V3 (Service Workers, Storage, Tabs, Alarms, Commands)
* **Security:** WebAuthn API, Web Crypto API (AES-GCM encryption, PBKDF2 Hashing)

---

## 👨‍💻 Developer & Credits

**Developed by:** [Md Rijoan Maruf](https://rijoan.com)

BrowserVault is built with a focus on delivering robust security without compromising on design and performance. 
