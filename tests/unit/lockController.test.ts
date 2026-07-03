import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────
// Chrome API mocks
// ─────────────────────────────────────────────────────────────

const store: Record<string, unknown> = {};

const mockTabMessages: Array<{ tabId: number; message: unknown }> = [];

const mockChrome = {
  storage: {
    local: {
      get: vi.fn((keys: string[], cb: (r: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (store[k] !== undefined) result[k] = store[k];
        });
        cb(result);
      }),
      set: vi.fn((items: Record<string, unknown>, cb: () => void) => {
        Object.assign(store, items);
        cb();
      }),
      remove: vi.fn((key: string | string[], cb: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => delete store[k]);
        cb();
      }),
    },
  },
  tabs: {
    query: vi.fn(async () => [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://another.com' },
      { id: 3, url: 'chrome://extensions' }, // should be filtered out
    ]),
    sendMessage: vi.fn(async (tabId: number, message: unknown) => {
      mockTabMessages.push({ tabId, message });
    }),
  },
};

global.chrome = mockChrome as unknown as typeof chrome;

// ─────────────────────────────────────────────────────────────
// Subject under test (imported AFTER mocks are set)
// ─────────────────────────────────────────────────────────────
import { lockBrowser, unlockBrowser, getLockStatus } from '@/background/lockController';

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('lockController', () => {
  beforeEach(() => {
    // Reset store and recorded messages
    for (const key of Object.keys(store)) delete store[key];
    mockTabMessages.length = 0;
    vi.clearAllMocks();

    // Re-assign query/sendMessage mocks after clearAllMocks
    mockChrome.tabs.query = vi.fn(async () => [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://another.com' },
      { id: 3, url: 'chrome://extensions' },
    ]);
    mockChrome.tabs.sendMessage = vi.fn(async (tabId: number, message: unknown) => {
      mockTabMessages.push({ tabId, message });
    });

    // Re-apply storage mocks
    mockChrome.storage.local.get = vi.fn((keys: string[], cb: (r: Record<string, unknown>) => void) => {
      const result: Record<string, unknown> = {};
      keys.forEach((k) => {
        if (store[k] !== undefined) result[k] = store[k];
      });
      cb(result);
    });
    mockChrome.storage.local.set = vi.fn((items: Record<string, unknown>, cb: () => void) => {
      Object.assign(store, items);
      cb();
    });
  });

  // ── getLockStatus ──────────────────────────────────────────

  describe('getLockStatus()', () => {
    it('returns default lock state when storage is empty', async () => {
      const state = await getLockStatus();
      expect(state.isLocked).toBe(false);
      expect(state.failedAttemptCount).toBe(0);
      expect(state.cooldownExpiresAt).toBeNull();
    });

    it('returns persisted lock state from storage', async () => {
      store['vault_lock_state'] = { isLocked: true, failedAttemptCount: 2, cooldownExpiresAt: null };
      const state = await getLockStatus();
      expect(state.isLocked).toBe(true);
      expect(state.failedAttemptCount).toBe(2);
    });
  });

  // ── lockBrowser ────────────────────────────────────────────

  describe('lockBrowser()', () => {
    it('sets isLocked to true in storage', async () => {
      await lockBrowser();
      const state = await getLockStatus();
      expect(state.isLocked).toBe(true);
    });

    it('broadcasts SHOW_LOCK_OVERLAY to non-chrome tabs only', async () => {
      await lockBrowser();
      // tabs 1 and 2 are regular pages; tab 3 is chrome:// so should be skipped
      expect(mockTabMessages).toHaveLength(2);
      expect(mockTabMessages[0]).toEqual({ tabId: 1, message: { action: 'SHOW_LOCK_OVERLAY' } });
      expect(mockTabMessages[1]).toEqual({ tabId: 2, message: { action: 'SHOW_LOCK_OVERLAY' } });
    });

    it('does not throw even if a tab sendMessage rejects', async () => {
      mockChrome.tabs.sendMessage = vi.fn().mockRejectedValue(new Error('Tab closed'));
      await expect(lockBrowser()).resolves.toBeUndefined();
    });
  });

  // ── unlockBrowser ──────────────────────────────────────────

  describe('unlockBrowser()', () => {
    it('returns noPasswordSet when no credentials are stored', async () => {
      const result = await unlockBrowser('any-password');
      expect(result.success).toBe(false);
      expect(result.noPasswordSet).toBe(true);
    });

    it('unlocks successfully with the correct password', async () => {
      // Pre-seed storage with a known hash + salt via crypto module
      const { hashPassword, generateSalt } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword('correct-pass', salt);
      store['vault_password_hash'] = hash;
      store['vault_password_salt'] = salt;
      store['vault_lock_state'] = { isLocked: true, failedAttemptCount: 0, cooldownExpiresAt: null };

      const result = await unlockBrowser('correct-pass');
      expect(result.success).toBe(true);

      const state = await getLockStatus();
      expect(state.isLocked).toBe(false);
      expect(state.failedAttemptCount).toBe(0);
    });

    it('broadcasts HIDE_LOCK_OVERLAY on successful unlock', async () => {
      const { hashPassword, generateSalt } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword('my-pass', salt);
      store['vault_password_hash'] = hash;
      store['vault_password_salt'] = salt;
      store['vault_lock_state'] = { isLocked: true, failedAttemptCount: 0, cooldownExpiresAt: null };

      await unlockBrowser('my-pass');
      const hideMessages = mockTabMessages.filter(
        (m) => (m.message as any).action === 'HIDE_LOCK_OVERLAY'
      );
      expect(hideMessages.length).toBeGreaterThan(0);
    });

    it('increments failedAttemptCount on wrong password', async () => {
      const { hashPassword, generateSalt } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword('correct-pass', salt);
      store['vault_password_hash'] = hash;
      store['vault_password_salt'] = salt;

      const result = await unlockBrowser('wrong-password');
      expect(result.success).toBe(false);
      expect(result.failedAttemptCount).toBe(1);

      const state = await getLockStatus();
      expect(state.failedAttemptCount).toBe(1);
    });

    it('accumulates failedAttemptCount across multiple failures', async () => {
      const { hashPassword, generateSalt } = await import('@/lib/crypto');
      const salt = generateSalt();
      const hash = await hashPassword('correct-pass', salt);
      store['vault_password_hash'] = hash;
      store['vault_password_salt'] = salt;

      await unlockBrowser('bad');
      await unlockBrowser('bad');
      const result = await unlockBrowser('bad');
      expect(result.failedAttemptCount).toBe(3);
    });
  });
});
