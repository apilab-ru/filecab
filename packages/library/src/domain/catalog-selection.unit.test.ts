import { describe, expect, it } from 'vitest';
import {
  Category,
  Granularity,
  Locale,
  emptySnapshot,
  type CatalogRecord,
  type Entry,
} from '@filecab/contracts';
import { manualCandidates, savedCatalogMatch } from './catalog-selection';

const provenance = { source: 'fixture', retrievedAt: '2026-11-14T00:00:00.000Z', verified: true };
const catalog: CatalogRecord = {
  schemaVersion: 1,
  catalogId: 'internal',
  category: Category.Films,
  granularity: Granularity.Film,
  snapshot: {
    ...emptySnapshot(),
    titles: [{ text: 'Exact title', language: 'en', provenance }],
    references: [
      {
        namespace: 'imdb',
        entity: 'title',
        id: 'tt001',
        granularity: Granularity.Film,
        provenance,
      },
    ],
  },
};

/** Creates a row for namespace and suggestion regressions. */
function row(id: string, overrides: Partial<Entry> = {}) {
  return {
    version: '1',
    entry: {
      schemaVersion: 1,
      entryId: id,
      catalogId: null,
      category: Category.Films,
      userTitle: 'Exact title',
      status: null,
      rating: 0,
      progress: 0,
      comment: '',
      sources: [],
      snapshot: emptySnapshot(),
      createdAt: '',
      updatedAt: '',
      serverVersion: null,
      deleted: false,
      ...overrides,
    } as Entry,
  };
}

describe('catalog selection', () => {
  it('does not promote equal titles or cross-namespace numeric IDs to identity', () => {
    const manual = row('manual');
    const collision = row('numeric', {
      snapshot: {
        ...emptySnapshot(),
        references: [{ ...catalog.snapshot.references[0]!, namespace: 'tmdb' }],
      },
    });

    expect(savedCatalogMatch([manual, collision], catalog)).toEqual({ kind: 'none' });
    expect(manualCandidates([manual], catalog, Locale.En)).toEqual([manual]);
    expect(
      manualCandidates([row('substring', { userTitle: 'Exact' })], catalog, Locale.En),
    ).toEqual([]);
  });

  it('reports category and contradictory-reference conflicts before opening an editor', () => {
    expect(
      savedCatalogMatch(
        [row('saved', { catalogId: catalog.catalogId, category: Category.Tv })],
        catalog,
      ),
    ).toMatchObject({ kind: 'match', categoryConflict: true });
    expect(
      savedCatalogMatch(
        [
          row('saved', {
            catalogId: catalog.catalogId,
            snapshot: {
              ...emptySnapshot(),
              references: [{ ...catalog.snapshot.references[0]!, id: 'tt002' }],
            },
          }),
        ],
        catalog,
      ),
    ).toMatchObject({ kind: 'conflict' });
  });
});
