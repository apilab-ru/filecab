import {
  matchEntry,
  type CatalogRecord,
  type Entry,
  type Locale,
  titleFor,
} from '@filecab/contracts';
import type { WorkspaceRow } from '../models/workspace';

/** Finds exact identity matches without using numeric or title equality as proof. */
export function savedCatalogMatch(rows: WorkspaceRow[], catalog: CatalogRecord) {
  return matchEntry(
    rows.map(({ entry }) => entry),
    { ...catalog, sources: [] },
  );
}

/** Finds whole-title manual suggestions that still require explicit selection and confirmation. */
export function manualCandidates(
  rows: WorkspaceRow[],
  catalog: CatalogRecord,
  locale: Locale,
): WorkspaceRow[] {
  const titles = new Set(
    catalog.snapshot.titles.map(({ text }) => text.trim().toLocaleLowerCase(locale)),
  );
  const display = titleFor(catalog.snapshot, locale, '').text.trim().toLocaleLowerCase(locale);
  titles.add(display);

  return rows.filter(
    ({ entry }) =>
      !entry.deleted &&
      entry.catalogId === null &&
      entry.category === catalog.category &&
      titles.has(entry.userTitle.trim().toLocaleLowerCase(locale)),
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
