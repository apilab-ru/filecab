import type { Backup, BackupComparison, BackupEntry, Entry } from '../models/index';

/** Serializes JSON with sorted object keys, so key order never changes a comparison. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;

  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;

  return JSON.stringify(value) ?? 'null';
}

/** Copies the portable fields of an entry. */
function backupEntry(entry: BackupEntry): BackupEntry {
  return {
    entryId: entry.entryId,
    catalogId: entry.catalogId,
    category: entry.category,
    userTitle: entry.userTitle,
    status: entry.status,
    rating: entry.rating,
    progress: entry.progress,
    comment: entry.comment,
    sources: entry.sources.map((source) => ({ ...source })),
    snapshot: structuredClone(entry.snapshot),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

/** Builds a current-format backup from the active entries only. */
export function toBackup(entries: readonly Entry[]): Backup {
  return {
    schemaVersion: 1,
    entries: entries.filter((entry) => !entry.deleted).map((entry) => backupEntry(entry)),
  };
}

/** Compares the user state of an active entry with its backup copy. */
function sameBackupState(current: Entry, incoming: BackupEntry): boolean {
  return canonical(backupEntry(current)) === canonical(backupEntry(incoming));
}

/** Counts the entries that a replacement adds, updates, keeps and removes, and its conflicts. */
export function compareBackup(current: readonly Entry[], backup: Backup): BackupComparison {
  const active = new Map(
    current.filter((entry) => !entry.deleted).map((entry) => [entry.entryId, entry]),
  );
  const comparison: BackupComparison = {
    current: active.size,
    incoming: backup.entries.length,
    added: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    conflicts: 0,
  };
  const incomingIds = new Set<string>();

  for (const entry of backup.entries) {
    incomingIds.add(entry.entryId);
    const existing = active.get(entry.entryId);

    if (!existing) comparison.added += 1;
    else if (sameBackupState(existing, entry)) comparison.unchanged += 1;
    else {
      comparison.updated += 1;

      if (Date.parse(existing.updatedAt) > Date.parse(entry.updatedAt)) comparison.conflicts += 1;
    }
  }

  for (const entryId of active.keys()) if (!incomingIds.has(entryId)) comparison.removed += 1;

  return comparison;
}

/** Reports whether a restore changes this active or retained entry. */
export function backupChanges(current: Entry | undefined, incoming: BackupEntry): boolean {
  return !current || current.deleted || !sameBackupState(current, incoming);
}
