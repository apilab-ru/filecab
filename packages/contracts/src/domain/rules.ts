import { Granularity } from '../models/granularity';
import type { Locale } from '../models/locale';
import type {
  Entry,
  EntryPatch,
  Genre,
  LocalizedText,
  ProviderReference,
  Snapshot,
  Provenance,
  RemoteListIdentity,
} from '../models/index';

/** Creates a snapshot with no known catalog metadata. */
export function emptySnapshot(): Snapshot {
  return {
    originalTitle: null,
    titles: [],
    descriptions: [],
    posterUrl: null,
    year: null,
    genres: [],
    format: null,
    episodeCount: null,
    availableEpisodeCount: null,
    providerRatings: [],
    references: [],
  };
}

/** Returns a positive safe episode count or null for unknown totals. */
export function normalizeEpisodeTotal(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Reports whether progress exceeds a known positive total. */
export function progressExceedsTotal(progress: number, total: number | null): boolean {
  return total !== null && total > 0 && progress > total;
}
/** Describes selected display text with its language, provenance and origin. */
export interface DisplayText {
  text: string;
  requestedLocale: Locale;
  language: string | null;
  provenance: Provenance | null;
  origin: 'catalog' | 'user' | 'fallback';
}

/** Builds display text from catalog metadata and its provenance. */
function localized(value: LocalizedText, locale: Locale): DisplayText {
  return {
    text: value.text,
    requestedLocale: locale,
    language: value.language,
    provenance: { ...value.provenance },
    origin: 'catalog',
  };
}

/** Builds user or fallback display text without catalog provenance. */
function ownText(text: string, locale: Locale, origin: 'user' | 'fallback'): DisplayText {
  return { text, requestedLocale: locale, language: null, provenance: null, origin };
}

/** Selects localized text matching the requested locale or a regional variant. */
function preferred(values: LocalizedText[], locale: Locale): LocalizedText | undefined {
  return (
    values.find((value) => value.language === locale) ??
    values.find((value) => value.language.startsWith(`${locale}-`))
  );
}

/** Selects a user title, catalog title or supplied fallback for display. */
export function titleFor(
  snapshot: Snapshot,
  locale: Locale,
  unavailableLabel: string,
  userTitle = '',
): DisplayText {
  if (userTitle.trim()) return ownText(userTitle, locale, 'user');

  const value = preferred(snapshot.titles, locale) ?? snapshot.originalTitle ?? snapshot.titles[0];

  return value ? localized(value, locale) : ownText(unavailableLabel, locale, 'fallback');
}

/** Selects a catalog description, user comment or supplied fallback. */
export function descriptionFor(
  snapshot: Snapshot,
  locale: Locale,
  comment: string,
  emptyLabel: string,
): DisplayText {
  const value = preferred(snapshot.descriptions, locale) ?? snapshot.descriptions[0];

  if (value) return localized(value, locale);

  return comment.trim()
    ? ownText(comment, locale, 'user')
    : ownText(emptyLabel, locale, 'fallback');
}

/** Selects a localized genre label with a stable key fallback. */
export function genreLabelFor(genre: Genre, locale: Locale): DisplayText {
  const value = preferred(genre.labels, locale) ?? genre.labels[0];

  return value ? localized(value, locale) : ownText(genre.key, locale, 'fallback');
}

/** Builds an identity key scoped to the provider, account and remote entity. */
export function remoteListKey(record: RemoteListIdentity): string {
  return JSON.stringify([record.provider, record.accountId, record.entity, record.recordId]);
}

/** Builds a provider reference key preserving namespace, entity and ID. */
export function referenceKey(reference: ProviderReference): string {
  return JSON.stringify([reference.namespace, reference.entity, reference.id]);
}

/** Checks whether verified references identify the same known granularity. */
export function equivalentReferences(a: ProviderReference, b: ProviderReference): boolean {
  return (
    a.provenance.verified &&
    b.provenance.verified &&
    a.granularity !== Granularity.Unknown &&
    a.granularity === b.granularity &&
    referenceKey(a) === referenceKey(b)
  );
}

/** Detects conflicting verified identities within the same provider entity. */
function contradictoryReferences(a: ProviderReference, b: ProviderReference): boolean {
  return (
    a.provenance.verified &&
    b.provenance.verified &&
    a.namespace === b.namespace &&
    a.entity === b.entity &&
    (a.id !== b.id ||
      (a.granularity !== Granularity.Unknown &&
        b.granularity !== Granularity.Unknown &&
        a.granularity !== b.granularity))
  );
}
export type MatchResult =
  | { kind: 'none' }
  | {
      kind: 'match';
      entryId: string;
      matchedBy: 'catalog' | 'reference' | 'source';
      categoryConflict: boolean;
    }
  | { kind: 'conflict'; entryIds: string[] };

/** Matches active entries by catalog, verified reference or source and reports conflicts. */
export function matchEntry(
  entries: readonly Entry[],
  candidate: Pick<Entry, 'category' | 'catalogId' | 'snapshot' | 'sources'>,
): MatchResult {
  const active = entries.filter((entry) => !entry.deleted);
  const catalog = active.filter(
    (entry) => candidate.catalogId !== null && entry.catalogId === candidate.catalogId,
  );
  const reference = active.filter((entry) =>
    entry.snapshot.references.some((a) =>
      candidate.snapshot.references.some((b) => equivalentReferences(a, b)),
    ),
  );
  const source = active.filter((entry) =>
    entry.sources.some((a) => candidate.sources.some((b) => a.normalizedUrl === b.normalizedUrl)),
  );
  const ids = [
    ...new Set([...catalog, ...reference, ...source].map((entry) => entry.entryId)),
  ].sort();

  if (ids.length > 1)
    return {
      kind: 'conflict',
      entryIds: ids,
    };

  const matched = catalog[0] ?? reference[0] ?? source[0];

  if (!matched)
    return {
      kind: 'none',
    };

  if (
    (matched.catalogId && candidate.catalogId && matched.catalogId !== candidate.catalogId) ||
    matched.snapshot.references.some((a) =>
      candidate.snapshot.references.some((b) => contradictoryReferences(a, b)),
    )
  )
    return { kind: 'conflict', entryIds: [matched.entryId] };

  let matchedBy: 'catalog' | 'reference' | 'source' = 'source';

  if (catalog.length) matchedBy = 'catalog';
  else if (reference.length) matchedBy = 'reference';

  return {
    kind: 'match',
    entryId: matched.entryId,
    matchedBy,
    categoryConflict: matched.category !== candidate.category,
  };
}

/** Extracts user-editable values for semantic comparison. */
function editable(entry: Entry): unknown[] {
  return [
    entry.category,
    entry.userTitle,
    entry.status,
    entry.rating,
    entry.progress,
    entry.comment,
    entry.sources.map((source) => [source.originalUrl, source.normalizedUrl, source.policyVersion]),
  ];
}

/** Checks whether user-editable values differ between entries. */
export function hasSemanticChange(before: Entry, after: Entry): boolean {
  return JSON.stringify(editable(before)) !== JSON.stringify(editable(after));
}

/** Builds a draft from a typed patch; the caller decides where to persist it. */
export function previewEntryPatch(entry: Entry, input: EntryPatch): Entry {
  const { sourceUrls, ...patch } = input;

  return {
    ...entry,
    category: patch.category ?? entry.category,
    userTitle: patch.userTitle ?? entry.userTitle,
    status: patch.status === undefined ? entry.status : patch.status,
    rating: patch.rating ?? entry.rating,
    progress: patch.progress ?? entry.progress,
    comment: patch.comment ?? entry.comment,
    sources:
      sourceUrls === undefined
        ? entry.sources
        : sourceUrls.map((originalUrl) => ({
            originalUrl,
            normalizedUrl: normalizeSourceUrl(originalUrl),
            policyVersion: 'generic-v1',
          })),
  };
}

/** Authoritative service supplies time/version; owner checks and transaction are step 4. */
export function applyEntryPatch(
  entry: Entry,
  input: EntryPatch,
  now: string,
  nextVersion: string,
): Entry {
  const proposed = previewEntryPatch(entry, input);

  if (!hasSemanticChange(entry, proposed)) return entry;

  return { ...proposed, updatedAt: now, serverVersion: nextVersion };
}

/** Merges keyed values, replacing existing values with incoming matches. */
function mergeBy<T>(previous: T[], incoming: T[], key: (value: T) => string): T[] {
  const values = new Map(previous.map((value) => [key(value), value]));
  incoming.forEach((value) => values.set(key(value), value));

  return [...values.values()];
}

/** Merges localized text by language and provenance source. */
function mergeText(previous: LocalizedText[], incoming: LocalizedText[]): LocalizedText[] {
  return mergeBy(previous, incoming, (value) =>
    JSON.stringify([value.language, value.provenance.source]),
  );
}

/** Missing provider metadata never erases known values or other translations. */
export function enrichSnapshot(previous: Snapshot, incoming: Snapshot): Snapshot {
  const mergedGenres = new Map(previous.genres.map((genre) => [genre.genreId, genre]));
  for (const genre of incoming.genres) {
    const old = mergedGenres.get(genre.genreId);
    mergedGenres.set(
      genre.genreId,
      old ? { ...genre, labels: mergeText(old.labels, genre.labels) } : genre,
    );
  }
  const references = mergeBy(previous.references, incoming.references, (value) =>
    JSON.stringify([
      referenceKey(value),
      value.granularity,
      value.provenance.source,
      value.provenance.verified,
    ]),
  );

  return {
    originalTitle: incoming.originalTitle ?? previous.originalTitle,
    titles: mergeText(previous.titles, incoming.titles),
    descriptions: mergeText(previous.descriptions, incoming.descriptions),
    posterUrl: incoming.posterUrl ?? previous.posterUrl,
    year: incoming.year ?? previous.year,
    genres: [...mergedGenres.values()],
    format: incoming.format ?? previous.format,
    episodeCount: incoming.episodeCount ?? previous.episodeCount,
    availableEpisodeCount: incoming.availableEpisodeCount ?? previous.availableEpisodeCount,
    providerRatings: mergeBy(
      previous.providerRatings,
      incoming.providerRatings,
      (value) => value.provenance.source,
    ),
    references,
  };
}

/** Enriches an entry snapshot while preserving entry fields. */
export function refreshEntrySnapshot(entry: Entry, incoming: Snapshot): Entry {
  return { ...entry, snapshot: enrichSnapshot(entry.snapshot, incoming) };
}

/** Normalizes URL syntax while preserving path, query and fragment semantics. */
export function normalizeSourceUrl(url: string): string {
  return new URL(url).href;
}
