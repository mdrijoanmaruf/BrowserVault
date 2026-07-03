/**
 * Activity Log — src/lib/activityLog.ts
 *
 * Append-only log writer and reader persisted in chrome.storage.local.
 * Keeps the most recent MAX_ENTRIES entries, automatically evicting old ones.
 */

import { storage } from './storage';
import { STORAGE_KEYS } from './constants';
import type { ActivityLogEntry } from '@/types';

const MAX_ENTRIES = 500;

/**
 * Appends a new entry to the activity log.
 * Automatically trims the log if it exceeds MAX_ENTRIES.
 */
export async function logActivity(
  type: ActivityLogEntry['type'],
  details?: string
): Promise<void> {
  const existing = (await storage.getItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG)) ?? [];

  const entry: ActivityLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    type,
    details,
  };

  const updated = [...existing, entry];
  // Keep only the most recent MAX_ENTRIES
  const trimmed = updated.length > MAX_ENTRIES ? updated.slice(updated.length - MAX_ENTRIES) : updated;

  await storage.setItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG, trimmed);
}

/**
 * Returns all activity log entries, most recent last.
 */
export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  return (await storage.getItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG)) ?? [];
}

/**
 * Clears the entire activity log.
 */
export async function clearActivityLog(): Promise<void> {
  await storage.setItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG, []);
}

/**
 * Prunes the activity log, removing entries older than the specified retention days.
 */
export async function pruneActivityLog(retentionDays: number): Promise<void> {
  // If retentionDays is extremely large (e.g. 36500 for "Never"), skip pruning.
  if (retentionDays >= 36500) return;

  const existing = await getActivityLog();
  if (existing.length === 0) return;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pruned = existing.filter((entry) => entry.timestamp >= cutoff);

  if (pruned.length !== existing.length) {
    await storage.setItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG, pruned);
  }
}
