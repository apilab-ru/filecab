import type { CatalogRecord, Entry } from '../models/index';
import { CatalogMatchOutcome } from '../models/catalog-match';

/** Quote characters that do not change a title. */
const QUOTES = /["«»“”„'‘’`]/g;

/** Dash characters that count as one hyphen. */
const DASHES = /[‐‑‒–—―]/g;

/**
 * Normalizes a title for exact comparison: Unicode compatibility form, lowercase, one space,
 * `ё` as `е`, no quotes and one kind of hyphen. Other characters still count.
 */
export function normalizeTitleForMatch(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(QUOTES, '')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns the title that the job searches for: the user title, else the first snapshot title. */
export function catalogMatchTitle(entry: Entry): string {
  return entry.userTitle.trim() || entry.snapshot.titles[0]?.text.trim() || '';
}

/**
 * Lists the normalized titles of a catalog record, including the original title. With
 * `alternative`, the other provider names of a search result count too.
 */
function recordTitles(record: CatalogRecord, alternative = false): Set<string> {
  return new Set(
    [
      ...record.snapshot.titles.map((title) => title.text),
      ...(record.snapshot.originalTitle ? [record.snapshot.originalTitle.text] : []),
      ...(alternative ? (record.alternativeTitles ?? []) : []),
    ]
      .map(normalizeTitleForMatch)
      .filter(Boolean),
  );
}

/**
 * Selects the catalog record of an entry from search results. Only an exact match links:
 * the same category, an equal normalized title, the same year when the entry has one, and
 * exactly one such record. An entry without a year matches by category and title only. The
 * other provider names of a result count as titles.
 */
export function matchCatalogRecord(
  entry: Entry,
  results: readonly CatalogRecord[],
):
  | { outcome: CatalogMatchOutcome.Linked; record: CatalogRecord }
  | { outcome: Exclude<CatalogMatchOutcome, CatalogMatchOutcome.Linked> } {
  const title = normalizeTitleForMatch(catalogMatchTitle(entry));
  const year = entry.snapshot.year;

  if (!title) return { outcome: CatalogMatchOutcome.NotFound };

  const matches = new Map<string, CatalogRecord>();

  for (const record of results)
    if (
      record.category === entry.category &&
      (year === null || record.snapshot.year === year) &&
      recordTitles(record, true).has(title)
    )
      matches.set(record.catalogId, record);

  if (matches.size === 1)
    return { outcome: CatalogMatchOutcome.Linked, record: [...matches.values()][0]! };

  return { outcome: matches.size ? CatalogMatchOutcome.Ambiguous : CatalogMatchOutcome.NotFound };
}

/**
 * Returns true when the user title only repeats a catalog title, so the catalog can name the
 * entry. An alternative provider name is not enough: the owner keeps the name they used.
 */
export function userTitleRepeatsCatalog(entry: Entry, record: CatalogRecord): boolean {
  return (
    Boolean(entry.userTitle.trim()) &&
    recordTitles(record).has(normalizeTitleForMatch(entry.userTitle))
  );
}
