import { type UserSettings, type LockState, type AuthState } from '@/types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  idleModeEnabled: false,
  idleDurationMinutes: 15,
  maxAttempts: 5,
  notifyBeforeLock: true,
  runInBackground: false,
  startState: 'history',
  clearHistoryOnLock: false,
  theme: 'system',
  logRetentionDays: 30,
  autoLockOnSleep: false,
  biometricUnlockEnabled: false,
};

export const DEFAULT_LOCK_STATE: LockState = {
  isLocked: false,
  failedAttemptCount: 0,
  cooldownExpiresAt: null,
};

export const DEFAULT_AUTH_STATE: AuthState = {
  hasPassword: false,
  hasPin: false,
  emailVerified: false,
  hasBackupCodes: false,
  hasBiometrics: false,
};

export const STORAGE_KEYS = {
  SETTINGS: 'vault_settings',
  LOCK_STATE: 'vault_lock_state',
  AUTH_STATE: 'vault_auth_state',
  ACTIVITY_LOG: 'vault_activity_log',
};

// ─── OTP / Backend Service ────────────────────────────────────────────────────
/** URL of the Express OTP dispatch service */
export const WORKER_ENDPOINT = 'https://browser-vault-backend.vercel.app/send-otp';

/**
 * Shared secret — must match the SHARED_SECRET environment variable
 * in the Express backend's .env file.
 * Replace before deploying!
 */
export const WORKER_SHARED_SECRET = '4f9e2d83b9c4a8f5d7e1c6a2b0f9d8c7e6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c';

/** OTP validity window in minutes */
export const OTP_EXPIRY_MINUTES = 10;
