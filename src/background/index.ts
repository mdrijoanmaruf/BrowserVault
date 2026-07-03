import { MessageRouter } from './messageRouter';
import { storage } from '@/lib/storage';

const router = new MessageRouter();
let isLocked = false;

// Initialize state from storage on startup
async function initializeState() {
  isLocked = await storage.getItem<boolean>('isLocked', false);
  console.log(`[BrowserVault] Service Worker started. Locked state: ${isLocked}`);
}

// Set up route handlers
router.on('GET_STATE', async () => {
  return { isLocked };
});

router.on('LOCK_BROWSER', async () => {
  isLocked = true;
  await storage.setItem('isLocked', true);
  console.log('[BrowserVault] Browser locked');
  return { success: true };
});

router.on('UNLOCK_BROWSER', async () => {
  isLocked = false;
  await storage.setItem('isLocked', false);
  console.log('[BrowserVault] Browser unlocked');
  return { success: true };
});

// Start listening for messages
router.listen();
initializeState();
