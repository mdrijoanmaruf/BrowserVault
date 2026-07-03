import { UserSettings, LockState, AuthState } from '@/types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  idleModeEnabled: false,
  idleDurationMinutes: 15,
  maxAttempts: 5,
  notifyBeforeLock: true,
  runInBackground: false,
  startState: 'history',
  clearHistoryOnLock: false,
  theme: 'system',
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
};

export const STORAGE_KEYS = {
  SETTINGS: 'vault_settings',
  LOCK_STATE: 'vault_lock_state',
  AUTH_STATE: 'vault_auth_state',
  ACTIVITY_LOG: 'vault_activity_log',
};
