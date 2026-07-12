
const ICON_URL = '/icons/icon128.png';

export type NotificationId =
  | 'bv-idle-warning'
  | 'bv-locked'
  | 'bv-cooldown';


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

export function clearNotification(id: NotificationId): void {
  chrome.notifications.clear(id, () => { /* no-op */ });
}
