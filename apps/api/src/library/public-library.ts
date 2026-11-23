import { Status, type Entry, type PublicEntry } from '@filecab/contracts';

/** Lowercase usernames that the database can hold. Other values cannot have a library. */
export const STORED_USERNAME = /^[a-z0-9][a-z0-9_-]{2,31}$/;

/** Builds the public projection: active, not hidden, without notes, links or identities. */
export function publicEntries(entries: readonly Entry[]): PublicEntry[] {
  return entries
    .filter((entry) => !entry.deleted && entry.status !== Status.Hide)
    .map((entry) => ({
      category: entry.category,
      userTitle: entry.userTitle,
      status: entry.status,
      rating: entry.rating,
      progress: entry.progress,
      snapshot: entry.snapshot,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
}
