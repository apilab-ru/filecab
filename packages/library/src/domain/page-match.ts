import {
  normalizeSourceUrl,
  type Category,
  type Locale,
  type PageExtraction,
} from '@filecab/contracts';
import type { WorkspaceRow } from '../models/workspace';

/** Describes how a read page relates to the saved library. */
export interface PageMatch {
  /** The entry that the page identifies, when the reference and the link agree. */
  saved?: WorkspaceRow;
  /** The reference and the link name different entries. Do not edit or merge silently. */
  conflict: WorkspaceRow[];
  /** Entries with the same title. They are suggestions that need confirmation. */
  candidates: WorkspaceRow[];
}

/** Normalizes a title for exact, case-insensitive comparison. */
function titleKey(text: string, locale: Locale): string {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase(locale);
}

/**
 * Matches a page to saved entries: a provider reference first, then the saved link.
 * A title match is only a suggestion. A substring never matches. A search-only page never
 * uses its URL.
 */
export function matchPage(
  rows: WorkspaceRow[],
  page: PageExtraction,
  title: string,
  category: Category | null,
  locale: Locale,
): PageMatch {
  const active = rows.filter(({ entry }) => !entry.deleted);
  const byReference = active.filter(({ entry }) =>
    page.references.some((reference) =>
      entry.snapshot.references.some(
        (known) =>
          known.namespace === reference.namespace &&
          known.entity === reference.entity &&
          known.id === reference.id,
      ),
    ),
  );
  const link = page.searchOnly ? null : normalizeSourceUrl(page.url);
  const byLink = link
    ? active.filter(({ entry }) => entry.sources.some((source) => source.normalizedUrl === link))
    : [];
  const identified = [
    ...new Map([...byReference, ...byLink].map((row) => [row.entry.entryId, row])).values(),
  ];

  if (identified.length > 1) return { conflict: identified, candidates: [] };

  if (identified.length === 1) return { saved: identified[0], conflict: [], candidates: [] };

  const key = titleKey(title, locale);
  const candidates = key
    ? active.filter(
        ({ entry }) =>
          (!category || entry.category === category) &&
          [entry.userTitle, ...entry.snapshot.titles.map(({ text }) => text)].some(
            (text) => titleKey(text, locale) === key,
          ),
      )
    : [];

  return { conflict: [], candidates };
}
