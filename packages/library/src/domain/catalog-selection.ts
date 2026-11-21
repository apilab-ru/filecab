import { matchEntry, type CatalogRecord, type Entry } from '@filecab/contracts';
import type { WorkspaceRow } from '../models/workspace';

/** Finds exact identity matches without using numeric or title equality as proof. */
export function savedCatalogMatch(rows: WorkspaceRow[], catalog: CatalogRecord) {
  return matchEntry(
    rows.map(({ entry }) => entry),
    { ...catalog, sources: [] },
  );
}

/** Copies every user field for a merge choice while keeping sources under merge control. */
export function retainedFields(entry: Entry) {
  return {
    userTitle: entry.userTitle,
    status: entry.status,
    rating: entry.rating,
    progress: entry.progress,
    comment: entry.comment,
  };
}
