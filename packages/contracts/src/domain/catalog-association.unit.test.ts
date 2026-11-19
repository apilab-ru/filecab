import { describe, expect, it } from 'vitest';
import { associateCatalog, CatalogAssociationConflictError } from './catalog-association';
import { emptySnapshot } from './rules';
import {
  Category,
  Granularity,
  Status,
  type CatalogRecord,
  type Entry,
  type ProviderReference,
} from '../index';

const catalog: CatalogRecord = {
  schemaVersion: 1,
  catalogId: 'catalog-1',
  category: Category.Films,
  granularity: Granularity.Film,
  snapshot: { ...emptySnapshot(), year: 2020 },
};

/** Creates a provider reference with the given identity and verification state. */
function reference(id: string, verified = true): ProviderReference {
  return {
    namespace: 'kinopoisk',
    entity: 'film',
    id,
    granularity: Granularity.Film,
    provenance: { source: 'kinopoisk', retrievedAt: '2025-01-01T00:00:00.000Z', verified },
  };
}

/** Creates an entry with meaningful private data for preservation checks. */
function entry(id: string, catalogId: string | null = null): Entry {
  return {
    schemaVersion: 1,
    entryId: id,
    catalogId,
    category: Category.Films,
    userTitle: '  Manual title  ',
    status: Status.Process,
    rating: 8,
    progress: 12,
    comment: '  Private\nnotes  ',
    sources: [
      {
        originalUrl: `https://watch.test/${id}`,
        normalizedUrl: `https://watch.test/${id}`,
        policyVersion: 'generic-v1',
      },
    ],
    snapshot: emptySnapshot(),
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    serverVersion: null,
    deleted: false,
  };
}

describe('catalog association intent', () => {
  it('preserves every manual field, UUID, added date and source while adding metadata', () => {
    const manual = entry('manual');
    const [result] = associateCatalog(manual, catalog);

    expect(result).toEqual({ ...manual, catalogId: catalog.catalogId, snapshot: catalog.snapshot });
    expect(manual.catalogId).toBeNull();
  });

  it('keeps the manual UUID, chosen donor fields and the survivor link without mutation', () => {
    const manual = entry('manual');
    const donor = { ...entry('donor', catalog.catalogId), comment: 'Other notes' };
    const result = associateCatalog(manual, catalog, donor, { comment: donor.comment, rating: 0 });

    expect(result[0]).toMatchObject({
      entryId: 'manual',
      createdAt: manual.createdAt,
      comment: 'Other notes',
      rating: 0,
      sources: manual.sources,
    });
    expect(result[1]).toEqual({ ...donor, deleted: true });
    expect(donor.deleted).toBe(false);
  });

  it('rejects category and existing identity changes rather than replacing an entry', () => {
    expect(() =>
      associateCatalog({ ...entry('manual'), category: Category.Tv }, catalog),
    ).toThrow();
    expect(() => associateCatalog(entry('manual', 'other-catalog'), catalog)).toThrow();
    expect(() =>
      associateCatalog(entry('manual'), catalog, entry('donor', 'other-catalog')),
    ).toThrow();
    expect(() => associateCatalog(entry('manual'), catalog, undefined, { sourceUrls: [] })).toThrow(
      CatalogAssociationConflictError,
    );
    expect(() =>
      associateCatalog(entry('manual'), catalog, undefined, { category: Category.Films }),
    ).toThrow(CatalogAssociationConflictError);
  });

  it('rejects a catalog item whose verified reference names another provider item', () => {
    const verified = {
      ...catalog,
      snapshot: { ...catalog.snapshot, references: [reference('100')] },
    };
    const known = (id: string, isVerified = true) => ({
      ...entry('manual'),
      snapshot: { ...emptySnapshot(), references: [reference(id, isVerified)] },
    });

    expect(() => associateCatalog(known('200'), verified)).toThrow(CatalogAssociationConflictError);
    expect(() => associateCatalog(known('100'), verified)).not.toThrow();
    expect(() => associateCatalog(known('200', false), verified)).not.toThrow();
  });

  it('keeps the survivor copy of a source link that the donor also has', () => {
    const manual = entry('manual');
    const donor = {
      ...entry('donor', catalog.catalogId),
      sources: [{ ...manual.sources[0], originalUrl: 'https://WATCH.test/manual' }],
    };
    const [result] = associateCatalog(manual, catalog, donor);

    expect(result.sources).toEqual(manual.sources);
  });

  it('gives a survivor without a link the donor link', () => {
    const donor = entry('donor', catalog.catalogId);
    const [result] = associateCatalog({ ...entry('manual'), sources: [] }, catalog, donor);

    expect(result.sources).toEqual(donor.sources);
  });
});
