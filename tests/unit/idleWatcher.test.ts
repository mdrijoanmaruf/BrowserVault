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
};

global.chrome = mockChrome as unknown as typeof chrome;

// ─────────────────────────────────────────────────────────────
// Mock lockBrowser so we don't need the full chrome.storage/tabs stack
// ─────────────────────────────────────────────────────────────
vi.mock('@/background/lockController', () => ({
  lockBrowser: vi.fn().mockResolvedValue(undefined),
}));

import { lockBrowser } from '@/background/lockController';
import { startIdleWatcher, stopIdleWatcher, isWatching } from '@/background/idleWatcher';

// ─────────────────────────────────────────────────────────────
// Helper: fire all registered idle listeners
// ─────────────────────────────────────────────────────────────
async function fireIdleState(state: IdleState): Promise<void> {
  // Fire synchronously and wait for async callbacks
  for (const listener of idleListeners) {
    await listener(state);
  }
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('idleWatcher', () => {
  beforeEach(() => {
    idleListeners.length = 0;
    _detectionInterval = 0;
    vi.clearAllMocks();

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
  });

  afterEach(() => {
    stopIdleWatcher();
  });

  // ── startIdleWatcher ──────────────────────────────────────

  describe('startIdleWatcher()', () => {
    it('does nothing when idleModeEnabled is false', () => {
      startIdleWatcher({ idleModeEnabled: false, idleDurationMinutes: 5 });
      expect(isWatching()).toBe(false);
      expect(idleListeners).toHaveLength(0);
    });

    it('sets detection interval and registers listener when enabled', () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 10 });
      expect(isWatching()).toBe(true);
      expect(_detectionInterval).toBe(600); // 10 * 60
      expect(idleListeners).toHaveLength(1);
    });

    it('clamps interval to minimum 15 seconds', () => {
      // 0 minutes → would be 0 seconds, but clamped to 15
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 0 });
      expect(_detectionInterval).toBe(15);
    });

    it('replaces existing watcher when called again', () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 5 });
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 15 });
      // Should still have only 1 active listener (old one removed, new one added)
      expect(idleListeners).toHaveLength(1);
      expect(_detectionInterval).toBe(900); // 15 * 60
    });
  });

  // ── stopIdleWatcher ───────────────────────────────────────

  describe('stopIdleWatcher()', () => {
    it('removes the listener and sets isWatching to false', () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 5 });
      expect(isWatching()).toBe(true);

      stopIdleWatcher();
      expect(isWatching()).toBe(false);
      expect(idleListeners).toHaveLength(0);
    });

    it('is safe to call when not watching', () => {
      expect(() => stopIdleWatcher()).not.toThrow();
    });
  });

  // ── idle state change handling ────────────────────────────

  describe('idle state handling', () => {
    it('calls lockBrowser() when state becomes "idle"', async () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 5 });
      await fireIdleState('idle');
      expect(lockBrowser).toHaveBeenCalledTimes(1);
    });

    it('calls lockBrowser() when state becomes "locked"', async () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 5 });
      await fireIdleState('locked');
      expect(lockBrowser).toHaveBeenCalledTimes(1);
    });

    it('does NOT call lockBrowser() when state is "active"', async () => {
      startIdleWatcher({ idleModeEnabled: true, idleDurationMinutes: 5 });
      await fireIdleState('active');
      expect(lockBrowser).not.toHaveBeenCalled();
    });
  });
});
