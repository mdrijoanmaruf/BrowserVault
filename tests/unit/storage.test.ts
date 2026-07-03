import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storage } from '@/lib/storage';

// Mock chrome API
const mockStorageLocal = {
  store: {} as Record<string, any>,
  get: vi.fn((keys: string[], callback: (result: any) => void) => {
    const result: Record<string, any> = {};
    keys.forEach((k) => {
      if (mockStorageLocal.store[k] !== undefined) {
        result[k] = mockStorageLocal.store[k];
      }
    });
    callback(result);
  }),
  set: vi.fn((items: Record<string, any>, callback: () => void) => {
    Object.assign(mockStorageLocal.store, items);
    callback();
  }),
  remove: vi.fn((key: string | string[], callback: () => void) => {
    const keys = Array.isArray(key) ? key : [key];
    keys.forEach((k) => {
      delete mockStorageLocal.store[k];
    });
    callback();
  }),
};

// @ts-ignore
global.chrome = {
  storage: {
    local: mockStorageLocal,
  },
};

describe('Storage Layer', () => {
  beforeEach(() => {
    mockStorageLocal.store = {};
    vi.clearAllMocks();
  });

  it('should set an item', async () => {
    await storage.setItem('test_key', { foo: 'bar' });
    expect(mockStorageLocal.set).toHaveBeenCalledWith({ test_key: { foo: 'bar' } }, expect.any(Function));
    expect(mockStorageLocal.store['test_key']).toEqual({ foo: 'bar' });
  });

  it('should get an item', async () => {
    mockStorageLocal.store['test_key'] = { foo: 'baz' };
    const result = await storage.getItem('test_key');
    expect(mockStorageLocal.get).toHaveBeenCalledWith(['test_key'], expect.any(Function));
    expect(result).toEqual({ foo: 'baz' });
  });

  it('should return defaultValue if item not found', async () => {
    const result = await storage.getItem('missing_key', 'default_val');
    expect(result).toBe('default_val');
  });

  it('should remove an item', async () => {
    mockStorageLocal.store['test_key'] = { foo: 'baz' };
    await storage.removeItem('test_key');
    expect(mockStorageLocal.remove).toHaveBeenCalledWith('test_key', expect.any(Function));
    expect(mockStorageLocal.store['test_key']).toBeUndefined();
  });
});
