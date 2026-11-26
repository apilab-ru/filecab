import { describe, expect, test } from 'vitest';
import { Category } from '../models/category';
import { CatalogMatchOutcome } from '../models/catalog-match';
import { Granularity } from '../models/granularity';
import type { CatalogRecord, Entry } from '../models/index';
import { importedEntry } from './library-import';
import { matchCatalogRecord, userTitleRepeatsCatalog } from './catalog-match';
import { emptySnapshot } from './rules';

const PROVENANCE = { source: 'test', retrievedAt: '2026-11-24T00:00:00.000Z', verified: true };

/** Builds an imported entry with a title and a year. */
function entry(title: string, year: number | null, category = Category.Films): Entry {
  return importedEntry(
    {
      line: 2,
      category,
      title,
      year,
      status: null,
      statusFromRating: false,
      rating: 0,
      progress: 0,
      comment: '',
      link: null,
      reference: null,
    },
    'entry-1',
    PROVENANCE.retrievedAt,
  );
}

/** Builds a catalog record with localized titles, an original title and a year. */
function record(
  catalogId: string,
  titles: string[],
  year: number | null,
  category = Category.Films,
  original?: string,
): CatalogRecord {
  return {
    schemaVersion: 1,
    catalogId,
    category,
    granularity: Granularity.Unknown,
    snapshot: {
      ...emptySnapshot(),
      year,
      titles: titles.map((text) => ({ text, language: 'ru', provenance: PROVENANCE })),
      originalTitle: original ? { text: original, language: 'en', provenance: PROVENANCE } : null,
    },
  };
}

describe('exact catalog match', () => {
  test('links one record with an equal normalized title and the same year', () => {
    const result = matchCatalogRecord(entry('«Кто она?»  Ёлка', 2022), [
      record('a', ['Кто она? Елка'], 2022),
      record('b', ['Кто она? Елка'], 2021),
      record('c', ['Кто она'], 2022),
    ]);
    expect(result).toMatchObject({
      outcome: CatalogMatchOutcome.Linked,
      record: { catalogId: 'a' },
    });
  });

  test('matches the original title and checks the category', () => {
    expect(
      matchCatalogRecord(entry('Anon', 2017), [
        record('a', ['Анон'], 2017, Category.Films, 'Anon'),
      ]),
    ).toMatchObject({ outcome: CatalogMatchOutcome.Linked });
    expect(
      matchCatalogRecord(entry('Anon', 2017, Category.Tv), [record('a', ['Anon'], 2017)]).outcome,
    ).toBe(CatalogMatchOutcome.NotFound);
  });

  test('several equal records are ambiguous', () => {
    expect(
      matchCatalogRecord(entry('Курск', 2018), [
        record('a', ['Курск'], 2018),
        record('b', ['Курск'], 2018),
      ]).outcome,
    ).toBe(CatalogMatchOutcome.Ambiguous);
  });

  test('an entry without a year matches by category and title only', () => {
    expect(
      matchCatalogRecord(entry('Курск', null), [
        record('a', ['Курск'], 2018),
        record('b', ['Курск 2'], 2019),
      ]),
    ).toMatchObject({ outcome: CatalogMatchOutcome.Linked, record: { catalogId: 'a' } });
    expect(
      matchCatalogRecord(entry('Курск', null), [
        record('a', ['Курск'], 2018),
        record('b', ['Курск'], 2004),
      ]).outcome,
    ).toBe(CatalogMatchOutcome.Ambiguous);
  });

  test('another provider name of a search result matches, but the user title stays', () => {
    const elf = {
      ...record('a', ['Эльф не может сидеть на диете'], 2024, Category.Anime),
      alternativeTitles: ['Эльф не может похудеть'],
    };
    const owned = entry('Эльф не может похудеть', null, Category.Anime);
    expect(matchCatalogRecord(owned, [elf])).toMatchObject({
      outcome: CatalogMatchOutcome.Linked,
      record: { catalogId: 'a' },
    });
    expect(userTitleRepeatsCatalog(owned, elf)).toBe(false);
  });

  test('a user title that repeats a catalog title can give way to the catalog title', () => {
    expect(userTitleRepeatsCatalog(entry('КУРСК', 2018), record('a', ['Курск'], 2018))).toBe(true);
    expect(userTitleRepeatsCatalog(entry('My Kursk', 2018), record('a', ['Курск'], 2018))).toBe(
      false,
    );
  });
});
