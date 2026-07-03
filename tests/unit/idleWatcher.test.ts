import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Chrome API mocks
// ─────────────────────────────────────────────────────────────

type IdleState = 'active' | 'idle' | 'locked';
const idleListeners: Array<(state: IdleState) => void> = [];
let _detectionInterval = 0;

const mockChrome = {
  idle: {
    setDetectionInterval: vi.fn((secs: number) => {
      _detectionInterval = secs;
    }),
    onStateChanged: {
      addListener: vi.fn((listener: (state: IdleState) => void) => {
        idleListeners.push(listener);
      }),
      removeListener: vi.fn((listener: (state: IdleState) => void) => {
        const idx = idleListeners.indexOf(listener);
        if (idx !== -1) idleListeners.splice(idx, 1);
      }),
    },
  },
  notifications: {
    create: vi.fn(),
    clear: vi.fn((_id: string, cb: () => void) => cb()),
  },
};

global.chrome = mockChrome as unknown as typeof chrome;

// ─────────────────────────────────────────────────────────────
// Mock lockBrowser and notificationsManager
// ─────────────────────────────────────────────────────────────

vi.mock('@/background/lockController', () => ({
  lockBrowser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/background/notificationsManager', () => ({
  showNotification: vi.fn(),
  clearNotification: vi.fn(),
}));

import { lockBrowser } from '@/background/lockController';
import { showNotification, clearNotification } from '@/background/notificationsManager';
import { startIdleWatcher, stopIdleWatcher, isWatching } from '@/background/idleWatcher';

// ─────────────────────────────────────────────────────────────
// Helper: fire all registered idle listeners
// ─────────────────────────────────────────────────────────────

async function fireIdleState(state: IdleState): Promise<void> {
  for (const listener of idleListeners) {
    await listener(state);
  }
}

/** Settings helper */
const enabledSettings = (notifyBeforeLock = false) => ({
  autoLockOnSleep: false,
  idleModeEnabled: true,
  idleDurationMinutes: 5,
  notifyBeforeLock,
});

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('idleWatcher', () => {
  beforeEach(() => {
    idleListeners.length = 0;
    _detectionInterval = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Re-wire mocks after clearAllMocks
    mockChrome.idle.setDetectionInterval = vi.fn((secs: number) => {
      _detectionInterval = secs;
    });
    mockChrome.idle.onStateChanged.addListener = vi.fn((listener: (state: IdleState) => void) => {
      idleListeners.push(listener);
    });
    mockChrome.idle.onStateChanged.removeListener = vi.fn((listener: (state: IdleState) => void) => {
      const idx = idleListeners.indexOf(listener);
      if (idx !== -1) idleListeners.splice(idx, 1);
    });
    mockChrome.notifications.create = vi.fn();
    mockChrome.notifications.clear = vi.fn((_id: string, cb: () => void) => cb());
  });

  afterEach(() => {
    stopIdleWatcher();
    vi.useRealTimers();
  });

  // ── startIdleWatcher ──────────────────────────────────────

  describe('startIdleWatcher()', () => {
    it('does nothing when idleModeEnabled is false', () => {
      startIdleWatcher({ autoLockOnSleep: false, idleModeEnabled: false, idleDurationMinutes: 5, notifyBeforeLock: false });
      expect(isWatching()).toBe(false);
      expect(idleListeners).toHaveLength(0);
    });

    it('sets detection interval and registers listener when enabled', () => {
      startIdleWatcher(enabledSettings());
      expect(isWatching()).toBe(true);
      expect(_detectionInterval).toBe(300); // 5 * 60
      expect(idleListeners).toHaveLength(1);
    });

    it('clamps interval to minimum 15 seconds', () => {
      startIdleWatcher({ autoLockOnSleep: false, idleModeEnabled: true, idleDurationMinutes: 0, notifyBeforeLock: false });
      expect(_detectionInterval).toBe(15);
    });

    it('replaces existing watcher when called again', () => {
      startIdleWatcher({ autoLockOnSleep: false, idleModeEnabled: true, idleDurationMinutes: 5, notifyBeforeLock: false });
      startIdleWatcher({ autoLockOnSleep: false, idleModeEnabled: true, idleDurationMinutes: 15, notifyBeforeLock: false });
      expect(idleListeners).toHaveLength(1);
      expect(_detectionInterval).toBe(900); // 15 * 60
    });
  });

  // ── stopIdleWatcher ───────────────────────────────────────

  describe('stopIdleWatcher()', () => {
    it('removes the listener and sets isWatching to false', () => {
      startIdleWatcher(enabledSettings());
      expect(isWatching()).toBe(true);
      stopIdleWatcher();
      expect(isWatching()).toBe(false);
      expect(idleListeners).toHaveLength(0);
    });

    it('is safe to call when not watching', () => {
      expect(() => stopIdleWatcher()).not.toThrow();
    });
  });

  // ── idle state handling (no notification) ────────────────

  describe('idle state handling — notifyBeforeLock: false', () => {
    it('calls lockBrowser() when state becomes "idle"', async () => {
      startIdleWatcher(enabledSettings(false));
      await fireIdleState('idle');
      vi.runAllTimers();
      await Promise.resolve(); // flush async
      expect(lockBrowser).toHaveBeenCalledTimes(1);
    });

    it('calls lockBrowser() when state becomes "locked"', async () => {
      startIdleWatcher(enabledSettings(false));
      await fireIdleState('locked');
      vi.runAllTimers();
      await Promise.resolve();
      expect(lockBrowser).toHaveBeenCalledTimes(1);
    });

    it('does NOT call lockBrowser() when state is "active"', async () => {
      startIdleWatcher(enabledSettings(false));
      await fireIdleState('active');
      vi.runAllTimers();
      expect(lockBrowser).not.toHaveBeenCalled();
    });
  });

  // ── idle state handling (with notification) ─ Day 14 ────

  describe('idle state handling — notifyBeforeLock: true (Day 14)', () => {
    it('shows warning notification when idle fires', async () => {
      startIdleWatcher(enabledSettings(true));
      await fireIdleState('idle');
      // Warning timer fires at 0ms (immediately) → then lock at 30s
      vi.advanceTimersByTime(0);
      expect(showNotification).toHaveBeenCalledWith(
        'bv-idle-warning',
        expect.stringContaining('Locking Soon'),
        expect.stringContaining('30 seconds')
      );
    });

    it('locks browser after warning lead time', async () => {
      startIdleWatcher(enabledSettings(true));
      await fireIdleState('idle');
      // Advance past the 30s lock timer
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      expect(clearNotification).toHaveBeenCalledWith('bv-idle-warning');
      expect(lockBrowser).toHaveBeenCalledTimes(1);
    });

    it('cancels lock when state becomes active again', async () => {
      startIdleWatcher(enabledSettings(true));
      await fireIdleState('idle');
      await fireIdleState('active'); // user came back
      vi.advanceTimersByTime(30_000); // advance past lock timer
      await Promise.resolve();
      // Lock should NOT have fired
      expect(lockBrowser).not.toHaveBeenCalled();
    });
  });
});
