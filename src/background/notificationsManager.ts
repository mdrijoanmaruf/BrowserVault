/**
 * Notifications Manager — Day 14
 *
 * Thin wrapper around chrome.notifications.create() for BrowserVault events.
 * Used to show a pre-lock warning before idle auto-lock fires.
 */

const ICON_URL = '/icons/icon128.png';

export type NotificationId =
  | 'bv-idle-warning'
  | 'bv-locked'
  | 'bv-cooldown';

/**
 * Shows a Chrome desktop notification.
 * Replaces any existing notification with the same id.
 */
export function showNotification(
  id: NotificationId,
  title: string,
  message: string
): void {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: ICON_URL,
    title,
    message,
    priority: 1,
  });
}

/**
 * Dismisses a notification by id.
 */
export function clearNotification(id: NotificationId): void {
  chrome.notifications.clear(id, () => { /* no-op */ });
}
