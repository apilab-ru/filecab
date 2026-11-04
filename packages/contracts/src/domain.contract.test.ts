import { describe, expect, test } from 'vitest';
import {
  Category,
  Status,
  Granularity,
  Locale,
  emptySnapshot,
  equivalentReferences,
  matchEntry,
  remoteListKey,
  normalizeSourceUrl,
  previewEntryPatch,
  applyEntryPatch,
  hasSemanticChange,
  progressExceedsTotal,
  normalizeEpisodeTotal,
  titleFor,
  descriptionFor,
  genreLabelFor,
  enrichSnapshot,
  refreshEntrySnapshot,
  type Entry,
  type ProviderReference,
  type Snapshot,
} from './index';

const time = '2026-11-03T00:00:00.000Z';

const later = '2026-11-03T00:00:01.000Z';

const id1 = '24fe2300-f3f1-4c3f-b318-e5e0b914f847';

const id2 = '606b293a-bc5c-4eb8-8747-a24f6343aa61';

const provenance = { source: 'fixture', retrievedAt: time, verified: true };

const text = (value: string, language: string) => ({ text: value, language, provenance });

const reference = (namespace = 'imdb', id = '001', entity = 'title'): ProviderReference => ({
  namespace,
  entity,
  id,
  granularity: Granularity.Film,
  provenance,
});

/** Builds a valid entry fixture with optional overrides. */
function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    schemaVersion: 1,
    entryId: id1,
    catalogId: null,
    category: Category.Anime,
    userTitle: '  My title\n',
    status: null,
    rating: 0,
    progress: 0,
    comment: '\nExact comment  ',
    sources: [],
    snapshot: emptySnapshot(),
    createdAt: time,
    updatedAt: time,
    serverVersion: '9007199254740993',
    deleted: false,
    ...overrides,
  };
}

describe('separate identities and deterministic matching', () => {
  test('namespace, entity, string formatting, trust and installment boundaries are significant', () => {
    expect(equivalentReferences(reference(), reference())).toBe(true);
    for (const other of [
      reference('tmdb'),
      reference('imdb', '1'),
      reference('imdb', '001', 'person'),
      { ...reference(), granularity: Granularity.Season },
      { ...reference(), granularity: Granularity.Unknown },
      { ...reference(), provenance: { ...provenance, verified: false } },
    ]) {
      expect(equivalentReferences(reference(), other)).toBe(false);
    }
    const record = {
      provider: 'shikimori',
      accountId: '001',
      entity: 'anime-rate',
      recordId: '007',
    };
    expect(record.recordId).toBe('007');
    expect(remoteListKey(record)).not.toBe(remoteListKey({ ...record, accountId: '1' }));
    expect(remoteListKey(record)).not.toBe(remoteListKey({ ...record, provider: 'other' }));
    expect(remoteListKey(record)).not.toBe(remoteListKey({ ...record, entity: 'anime' }));
    expect('001').toBe('001');
  });

  test('only verified identities match; equal titles and numeric IDs in other namespaces do not', () => {
    const saved = entry({ snapshot: { ...emptySnapshot(), references: [reference()] } });
    expect(
      matchEntry(
        [saved],
        entry({ snapshot: { ...emptySnapshot(), references: [reference('tmdb')] } }),
      ),
    ).toEqual({ kind: 'none' });
    expect(matchEntry([saved], saved)).toEqual({
      kind: 'match',
      entryId: id1,
      matchedBy: 'reference',
      categoryConflict: false,
    });
    expect(matchEntry([entry()], entry())).toEqual({ kind: 'none' });
    expect(matchEntry([entry({ ...saved, deleted: true })], saved)).toEqual({ kind: 'none' });
  });

  test('repeated catalog identity surfaces category conflict instead of changing category', () => {
    const saved = entry({ catalogId: 'internal-1' });
    expect(
      matchEntry([saved], entry({ catalogId: 'internal-1', category: Category.Films })),
    ).toEqual({
      kind: 'match',
      entryId: id1,
      matchedBy: 'catalog',
      categoryConflict: true,
    });
    expect(saved.category).toBe('anime');
  });

  test('multiple or contradictory identity/source candidates require explicit resolution', () => {
    const saved = entry({ catalogId: 'internal-1' });
    const second = previewEntryPatch(entry({ entryId: id2 }), {
      sourceUrls: ['https://example.com/title'],
    });
    const candidate = { ...second, catalogId: 'internal-1' };
    expect(matchEntry([saved, second], candidate)).toEqual({
      kind: 'conflict',
      entryIds: [id1, id2].sort(),
    });
    expect(matchEntry([second, saved], candidate)).toEqual(matchEntry([saved, second], candidate));
    expect(matchEntry([second], candidate)).toMatchObject({ kind: 'match', matchedBy: 'source' });
    expect(matchEntry([{ ...second, catalogId: 'internal-2' }], candidate)).toMatchObject({
      kind: 'conflict',
    });
    const a = { ...second, snapshot: { ...emptySnapshot(), references: [reference()] } };
    const b = {
      ...second,
      snapshot: { ...emptySnapshot(), references: [reference('imdb', '002')] },
    };
    expect(matchEntry([a], b)).toMatchObject({ kind: 'conflict' });
  });
});

describe('user edit semantics', () => {
  test('preserves identity and creation time while updating exact text and server modification state', () => {
    const before = entry();
    const after = applyEntryPatch(
      before,
      { userTitle: '  New\n', comment: '  Notes\n' },
      later,
      '9007199254740994',
    );
    expect(after).toMatchObject({
      entryId: before.entryId,
      createdAt: time,
      userTitle: '  New\n',
      comment: '  Notes\n',
      updatedAt: later,
      serverVersion: '9007199254740994',
    });
    expect(before.updatedAt).toBe(time);
    expect(applyEntryPatch(before, { rating: 1 }, time, '9007199254740994').updatedAt).toBe(time); // same-millisecond edit
  });

  test('omission/no-op preserves timestamps and versions; explicit clears reset only selected fields', () => {
    const before = previewEntryPatch(entry({ status: Status.Complete, rating: 9, progress: 3 }), {
      sourceUrls: ['https://example.com/title'],
    });
    expect(applyEntryPatch(before, {}, later, '9007199254740994')).toBe(before);
    expect(
      applyEntryPatch(
        before,
        { comment: before.comment, userTitle: undefined },
        later,
        '9007199254740994',
      ),
    ).toBe(before);
    const after = applyEntryPatch(
      before,
      { status: null, rating: 0, progress: 0, comment: '', sourceUrls: [] },
      later,
      '9007199254740994',
    );
    expect(after).toMatchObject({
      status: null,
      rating: 0,
      progress: 0,
      comment: '',
      sources: [],
      userTitle: before.userTitle,
    });
  });

  test('progress warns above totals, preserves historical excess and never automatically changes status', () => {
    const before = entry({ snapshot: { ...emptySnapshot(), episodeCount: 2 } });
    const after = previewEntryPatch(before, { progress: 3 });
    expect(progressExceedsTotal(after.progress, after.snapshot.episodeCount)).toBe(true);
    expect(after.status).toBeNull();
    expect(previewEntryPatch(after, { status: Status.Complete }).progress).toBe(3);
    expect(previewEntryPatch(before, { progress: 2 }).status).toBeNull();
    expect(previewEntryPatch(before, { progress: Number.MAX_SAFE_INTEGER }).progress).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    for (const total of [0, -1, null, undefined, 1.1, Number.MAX_SAFE_INTEGER + 1, '2'])
      expect(normalizeEpisodeTotal(total)).toBeNull();
    expect(normalizeEpisodeTotal(2)).toBe(2);
    expect(progressExceedsTotal(3, null)).toBe(false);
  });

  test('semantic comparison ignores metadata and key order, but retains source order and original text changes', () => {
    const before = previewEntryPatch(entry(), {
      sourceUrls: ['https://EXAMPLE.com/one', 'https://example.com/two'],
    });
    const reorderedKeys = {
      ...before,
      sources: before.sources.map((source) => ({
        policyVersion: source.policyVersion,
        normalizedUrl: source.normalizedUrl,
        originalUrl: source.originalUrl,
      })),
    };
    expect(hasSemanticChange(before, reorderedKeys)).toBe(false);
    expect(hasSemanticChange(before, { ...before, sources: [...before.sources].reverse() })).toBe(
      true,
    );
    expect(
      hasSemanticChange(
        before,
        previewEntryPatch(before, {
          sourceUrls: ['https://example.com/one', 'https://example.com/two'],
        }),
      ),
    ).toBe(true);
    expect(
      hasSemanticChange(before, {
        ...before,
        snapshot: { ...emptySnapshot(), titles: [text('Title', 'en')] },
      }),
    ).toBe(false);
  });
});

describe('conservative viewing source normalization', () => {
  test('canonicalizes standard syntax while preserving scheme/path/query/fragment semantics and original input', () => {
    const original = 'HTTPS://EXAMPLE.COM:443/A/?b=2&a=1#Part';
    const normalized = 'https://example.com/A/?b=2&a=1#Part';
    expect(normalizeSourceUrl(original)).toBe(normalized);
    for (const different of [
      'http://example.com/A/?b=2&a=1#Part',
      'https://www.example.com/A/?b=2&a=1#Part',
      'https://example.com/a/?b=2&a=1#Part',
      'https://example.com/A?b=2&a=1#Part',
      'https://example.com/A/?a=1&b=2#Part',
      'https://example.com/A/?b=2&a=1#part',
    ])
      expect(normalizeSourceUrl(different)).not.toBe(normalized);
    expect(previewEntryPatch(entry(), { sourceUrls: [original] }).sources[0]).toEqual({
      originalUrl: original,
      normalizedUrl: normalized,
      policyVersion: 'generic-v1',
    });
  });
});

describe('language fallback and metadata enrichment', () => {
  test('selects requested language, then original, then other, without guessing unknown text language', () => {
    const snapshot: Snapshot = {
      ...emptySnapshot(),
      originalTitle: text('原作', 'ja'),
      titles: [text('Unknown title', 'unknown'), text('Название', 'ru')],
    };
    expect(titleFor(snapshot, Locale.Ru, 'Нет')).toMatchObject({
      text: 'Название',
      requestedLocale: 'ru',
      language: 'ru',
      provenance,
      origin: 'catalog',
    });
    expect(titleFor(snapshot, Locale.En, 'Unavailable')).toMatchObject({
      text: '原作',
      language: 'ja',
    });
    expect(titleFor({ ...snapshot, originalTitle: null }, Locale.En, 'Unavailable')).toMatchObject({
      text: 'Unknown title',
      language: 'unknown',
    });
    expect(titleFor(emptySnapshot(), Locale.En, 'Unavailable')).toMatchObject({
      text: 'Unavailable',
      language: null,
      provenance: null,
      origin: 'fallback',
    });
    expect(titleFor(snapshot, Locale.En, 'Unavailable', '  My name ')).toMatchObject({
      text: '  My name ',
      origin: 'user',
      language: null,
    });
    expect(descriptionFor(emptySnapshot(), Locale.En, '  Note ', 'Empty')).toMatchObject({
      text: '  Note ',
      origin: 'user',
    });
    expect(
      descriptionFor(
        { ...snapshot, descriptions: [text('Описание', 'ru')] },
        Locale.En,
        'Note',
        'Empty',
      ),
    ).toMatchObject({ text: 'Описание', language: 'ru', origin: 'catalog' });
    expect(descriptionFor(emptySnapshot(), Locale.Ru, '  ', 'Пусто')).toMatchObject({
      text: 'Пусто',
      origin: 'fallback',
    });
    expect(genreLabelFor({ genreId: 'g-1', key: 'drama', labels: [] }, Locale.En).text).toBe(
      'drama',
    );
    expect(
      genreLabelFor(
        { genreId: 'g-1', key: 'drama', labels: [text('Драма', 'ru'), text('Drama', 'en')] },
        Locale.En,
      ).language,
    ).toBe('en');
  });

  test('locale fallback and refresh leave identity, user fields, timestamps and other translations intact', () => {
    const before = entry({
      snapshot: {
        ...emptySnapshot(),
        titles: [text('English', 'en')],
        year: 2020,
        episodeCount: 12,
        genres: [{ genreId: 'g-1', key: 'drama', labels: [text('Drama', 'en')] }],
      },
    });
    const original = JSON.stringify(before);
    titleFor(before.snapshot, Locale.Ru, 'Нет', before.userTitle);
    descriptionFor(before.snapshot, Locale.En, before.comment, 'Empty');
    expect(JSON.stringify(before)).toBe(original);
    const incoming = {
      ...emptySnapshot(),
      titles: [text('Русский', 'ru')],
      genres: [{ genreId: 'g-1', key: 'drama', labels: [text('Драма', 'ru')] }],
    };
    const after = refreshEntrySnapshot(before, incoming);
    expect(after.snapshot.titles.map((value) => value.language)).toEqual(['en', 'ru']);
    expect(after.snapshot.genres[0].labels.map((value) => value.language)).toEqual(['en', 'ru']);
    expect(after.snapshot.year).toBe(2020);
    expect(after.snapshot.episodeCount).toBe(12);
    expect({ ...after, snapshot: before.snapshot }).toEqual(before);
    expect(enrichSnapshot(after.snapshot, emptySnapshot())).toEqual(after.snapshot);
    expect(hasSemanticChange(before, after)).toBe(false);
  });
});
