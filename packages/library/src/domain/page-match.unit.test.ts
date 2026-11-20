import { describe, expect, it } from 'vitest';
import {
  Category,
  Granularity,
  Locale,
  emptySnapshot,
  type Entry,
  type PageExtraction,
} from '@filecab/contracts';
import { matchPage } from './page-match';

/** Builds a saved row with an optional link and Kinopoisk reference. */
function row(entryId: string, fields: Partial<Entry> = {}, reference?: string) {
  const entry: Entry = {
    schemaVersion: 1,
    entryId,
    catalogId: null,
    category: Category.Films,
    userTitle: entryId,
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sources: [],
    snapshot: {
      ...emptySnapshot(),
      references: reference
        ? [
            {
              namespace: 'kinopoisk',
              entity: 'title',
              id: reference,
              granularity: Granularity.Film,
              provenance: { source: 'fixture', retrievedAt: '', verified: true },
            },
          ]
        : [],
    },
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    serverVersion: null,
    deleted: false,
    ...fields,
  };

  return { entry, version: '1' };
}

/** Builds a Kinopoisk page extraction. */
function page(fields: Partial<PageExtraction> = {}): PageExtraction {
  return {
    url: 'https://www.kinopoisk.ru/film/301/',
    title: 'Матрица',
    category: Category.Films,
    references: [{ namespace: 'kinopoisk', entity: 'title', id: '301' }],
    ruleId: 'kinopoisk',
    searchOnly: false,
    ...fields,
  };
}

const link = (url: string) => ({
  sources: [{ originalUrl: url, normalizedUrl: url, policyVersion: 'generic-v1' as const }],
});

describe('page matching', () => {
  it('opens the entry that the reference or the saved link identifies', () => {
    const byReference = row('reference', {}, '301');
    const byLink = row('link', link('https://www.kinopoisk.ru/film/301/'));

    expect(matchPage([byReference], page(), 'Матрица', null, Locale.Ru).saved).toBe(byReference);
    expect(matchPage([byLink], page(), 'Матрица', null, Locale.Ru).saved).toBe(byLink);
  });

  it('reports a conflict when the reference and the link name different entries', () => {
    const result = matchPage(
      [row('reference', {}, '301'), row('link', link('https://www.kinopoisk.ru/film/301/'))],
      page(),
      'Матрица',
      null,
      Locale.Ru,
    );

    expect(result.saved).toBeUndefined();
    expect(result.conflict.map(({ entry }) => entry.entryId)).toEqual(['reference', 'link']);
  });

  it('suggests only exact case-insensitive titles in the category and ignores a search-only URL', () => {
    const rows = [
      row('exact', { userTitle: '  МАТРИЦА ' }),
      row('substring', { userTitle: 'Матрица: Перезагрузка' }),
      row('other category', { userTitle: 'Матрица', category: Category.Tv }),
      row('link', link('https://mirf.ru/news/1')),
    ];
    const result = matchPage(
      rows,
      page({ url: 'https://mirf.ru/news/1', references: [], searchOnly: true }),
      'матрица',
      Category.Films,
      Locale.Ru,
    );

    expect(result.saved).toBeUndefined();
    expect(result.candidates.map(({ entry }) => entry.entryId)).toEqual(['exact']);
  });
});
