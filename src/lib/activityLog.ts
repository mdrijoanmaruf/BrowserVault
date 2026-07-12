

import { storage } from './storage';
import { STORAGE_KEYS } from './constants';
import type { ActivityLogEntry } from '@/types';

const MAX_ENTRIES = 500;

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


export async function getActivityLog(): Promise<ActivityLogEntry[]> {
  return (await storage.getItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG)) ?? [];
}


export async function clearActivityLog(): Promise<void> {
  await storage.setItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG, []);
}


export async function pruneActivityLog(retentionDays: number): Promise<void> {
  if (retentionDays >= 36500) return;

  const existing = await getActivityLog();
  if (existing.length === 0) return;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const pruned = existing.filter((entry) => entry.timestamp >= cutoff);

  if (pruned.length !== existing.length) {
    await storage.setItem<ActivityLogEntry[]>(STORAGE_KEYS.ACTIVITY_LOG, pruned);
  }
}
