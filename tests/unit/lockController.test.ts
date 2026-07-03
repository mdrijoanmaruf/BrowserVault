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
        keys.forEach((k) => { if (store[k] !== undefined) result[k] = store[k]; });
        cb(result);
      }),
      set: vi.fn((items: Record<string, unknown>, cb: () => void) => {
        Object.assign(store, items); cb();
      }),
      remove: vi.fn((key: string | string[], cb: () => void) => {
        const keys = Array.isArray(key) ? key : [key];
        keys.forEach((k) => delete store[k]); cb();
      }),
    },
  },
  tabs: {
    query: vi.fn(async () => [
      { id: 1, url: 'https://example.com' },
      { id: 2, url: 'https://another.com' },
      { id: 3, url: 'chrome://extensions' },
    ]),
    sendMessage: vi.fn(async (tabId: number, message: unknown) => {
      mockTabMessages.push({ tabId, message });
    }),
  },
};

global.chrome = mockChrome as unknown as typeof chrome;

import { lockBrowser, unlockBrowser, getLockStatus } from '@/background/lockController';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function resetMocks() {
  for (const key of Object.keys(store)) delete store[key];
  mockTabMessages.length = 0;
  vi.clearAllMocks();

  mockChrome.tabs.query = vi.fn(async () => [
    { id: 1, url: 'https://example.com' },
    { id: 2, url: 'https://another.com' },
    { id: 3, url: 'chrome://extensions' },
  ]);
  mockChrome.tabs.sendMessage = vi.fn(async (tabId: number, message: unknown) => {
    mockTabMessages.push({ tabId, message });
  });
  mockChrome.storage.local.get = vi.fn((keys: string[], cb: (r: Record<string, unknown>) => void) => {
    const result: Record<string, unknown> = {};
    keys.forEach((k) => { if (store[k] !== undefined) result[k] = store[k]; });
    cb(result);
  });
  mockChrome.storage.local.set = vi.fn((items: Record<string, unknown>, cb: () => void) => {
    Object.assign(store, items); cb();
  });
}

async function seedPassword(plain: string) {
  const { hashPassword, generateSalt } = await import('@/lib/crypto');
  const salt = generateSalt();
  const hash = await hashPassword(plain, salt);
  store['vault_password_hash'] = hash;
  store['vault_password_salt'] = salt;
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe('lockController', () => {
  beforeEach(resetMocks);

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
      expect(mockTabMessages).toHaveLength(2);
      expect(mockTabMessages[0]).toEqual({ tabId: 1, message: { action: 'SHOW_LOCK_OVERLAY' } });
      expect(mockTabMessages[1]).toEqual({ tabId: 2, message: { action: 'SHOW_LOCK_OVERLAY' } });
    });

    it('does not throw when a tab sendMessage rejects', async () => {
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

    it('unlocks successfully with correct password', async () => {
      await seedPassword('correct-pass');
      store['vault_lock_state'] = { isLocked: true, failedAttemptCount: 0, cooldownExpiresAt: null };

      const result = await unlockBrowser('correct-pass');
      expect(result.success).toBe(true);

      const state = await getLockStatus();
      expect(state.isLocked).toBe(false);
      expect(state.failedAttemptCount).toBe(0);
    });

    it('broadcasts HIDE_LOCK_OVERLAY on successful unlock', async () => {
      await seedPassword('my-pass');
      store['vault_lock_state'] = { isLocked: true, failedAttemptCount: 0, cooldownExpiresAt: null };

      await unlockBrowser('my-pass');
      const hideMessages = mockTabMessages.filter((m) => (m.message as { action: string }).action === 'HIDE_LOCK_OVERLAY');
      expect(hideMessages.length).toBeGreaterThan(0);
    });

    // ── Day 12: maxAttempts ────────────────────────────────

    it('returns remainingAttempts on wrong password (Day 12)', async () => {
      await seedPassword('correct-pass');
      const result = await unlockBrowser('wrong', 3);
      expect(result.success).toBe(false);
      expect(result.failedAttemptCount).toBe(1);
      expect(result.remainingAttempts).toBe(2);
    });

    it('accumulates failedAttemptCount across multiple failures', async () => {
      await seedPassword('correct-pass');
      await unlockBrowser('bad', 5);
      await unlockBrowser('bad', 5);
      const result = await unlockBrowser('bad', 5);
      expect(result.failedAttemptCount).toBe(3);
      expect(result.remainingAttempts).toBe(2);
    });

    it('resets failedAttemptCount on successful unlock', async () => {
      await seedPassword('correct-pass');
      await unlockBrowser('bad', 5);
      await unlockBrowser('bad', 5);
      await unlockBrowser('correct-pass', 5);

      const state = await getLockStatus();
      expect(state.failedAttemptCount).toBe(0);
    });

    // ── Day 13: cooldown ───────────────────────────────────

    it('sets cooldownExpiresAt when maxAttempts is reached (Day 13)', async () => {
      await seedPassword('correct-pass');
      const before = Date.now();
      const result = await unlockBrowser('bad', 3);
      await unlockBrowser('bad', 3);
      const cooldownResult = await unlockBrowser('bad', 3); // 3rd attempt hits max

      expect(cooldownResult.success).toBe(false);
      expect(cooldownResult.cooldownActive).toBe(true);
      expect(cooldownResult.cooldownExpiresAt).toBeGreaterThan(before);

      const state = await getLockStatus();
      expect(state.cooldownExpiresAt).not.toBeNull();

      // Suppress unused variable warning
      void result;
    });

    it('rejects attempts during active cooldown without password check', async () => {
      await seedPassword('correct-pass');
      // Manually set an active cooldown
      store['vault_lock_state'] = {
        isLocked: true,
        failedAttemptCount: 3,
        cooldownExpiresAt: Date.now() + 300_000,
      };

      // Even with the correct password, cooldown should block
      const result = await unlockBrowser('correct-pass', 3);
      expect(result.success).toBe(false);
      expect(result.cooldownActive).toBe(true);
    });

    it('clears cooldown after it expires', async () => {
      await seedPassword('correct-pass');
      // Set a cooldown that is already expired
      store['vault_lock_state'] = {
        isLocked: true,
        failedAttemptCount: 3,
        cooldownExpiresAt: Date.now() - 1000, // expired 1 second ago
      };

      const result = await unlockBrowser('correct-pass', 3);
      expect(result.success).toBe(true);
    });
  });
});
