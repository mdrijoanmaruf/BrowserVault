import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '@/background/messageRouter';

// Mock chrome.runtime
const listeners: ((message: any, sender: any, sendResponse: any) => boolean)[] = [];
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: vi.fn((listener) => {
        listeners.push(listener);
      }),
    },
  },
};

global.chrome = mockChrome as any;

describe('MessageRouter', () => {
  beforeEach(() => {
    listeners.length = 0;
    vi.clearAllMocks();
  });

  it('should register handlers and listen for messages', async () => {
    const router = new MessageRouter();
    
    const handler = vi.fn().mockResolvedValue('test response');
    router.on('TEST_ACTION', handler);
    
    router.listen();
    
    expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    expect(listeners).toHaveLength(1);

    // Simulate an incoming message
    const sendResponse = vi.fn();
    const result = listeners[0]({ action: 'TEST_ACTION', payload: { foo: 'bar' } }, {}, sendResponse);
    
    // Should return true to indicate async response
    expect(result).toBe(true);
    
    // Wait for the promise to resolve in the background
    await new Promise(process.nextTick);

    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    expect(sendResponse).toHaveBeenCalledWith({ success: true, data: 'test response' });
  });

  it('should handle handler errors gracefully', async () => {
    const router = new MessageRouter();
    
    const handler = vi.fn().mockRejectedValue(new Error('Handler failed'));
    router.on('TEST_ERROR', handler);
    router.listen();
    
    const sendResponse = vi.fn();
    listeners[0]({ action: 'TEST_ERROR' }, {}, sendResponse);
    
    await new Promise(process.nextTick);

    expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'Handler failed' });
  });

  it('should ignore unhandled actions', () => {
    const router = new MessageRouter();
    router.listen();
    
    const sendResponse = vi.fn();
    const result = listeners[0]({ action: 'UNKNOWN_ACTION' }, {}, sendResponse);
    
    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
