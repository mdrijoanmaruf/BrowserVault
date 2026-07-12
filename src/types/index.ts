export interface UserSettings {
  idleModeEnabled: boolean;
  idleDurationMinutes: number;
  maxAttempts: number;
  notifyBeforeLock: boolean;
  runInBackground: boolean;
  startState: 'history' | 'allTabs' | 'blank' | 'customUrl';
  customUrl?: string;
  clearHistoryOnLock: boolean;
  theme: 'light' | 'dark' | 'system';
  logRetentionDays: number;
  autoLockOnSleep: boolean;
  biometricUnlockEnabled: boolean;
  restrictedDomains: string[];
  scheduledLockEnabled: boolean;
  scheduledLockTime: string;
}

export interface AuthState {
  hasPassword: boolean;
  hasPin: boolean;
  emailVerified: boolean;
  recoveryEmail?: string;
  hasBackupCodes: boolean;
  hasBiometrics: boolean;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  type:
    | 'LOCK'
    | 'UNLOCK'
    | 'FAILED_ATTEMPT'
    | 'SETTINGS_CHANGE'
    | 'PASSWORD_CHANGE'
    | 'EMAIL_CHANGE';
  details?: string;
}

export interface LockState {
  isLocked: boolean;
  failedAttemptCount: number;
  cooldownExpiresAt: number | null;
}

export interface ProfileConfig {
  profileId: string;
  settings: UserSettings;
}
