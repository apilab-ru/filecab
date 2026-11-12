import { Category, Locale } from '@filecab/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogIdentityService } from './catalog-identity.service';
import { KinopoiskDevAdapter } from './kinopoisk-dev.adapter';
import type { KinopoiskMovieDto } from './kinopoisk-dev.dto';

/** Supplies isolated provider pages and observable persistence for pagination regressions. */
function fixture(pages: KinopoiskMovieDto[][], total?: number) {
  const observe = vi
    .fn<CatalogIdentityService['observe']>()
    .mockImplementation(async (category, granularity, snapshot) => ({
      schemaVersion: 1,
      catalogId: snapshot.references[0].id,
      category,
      granularity,
      snapshot,
    }));
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const page = Number(new URL(String(input)).searchParams.get('page'));

    return new Response(JSON.stringify({ page, limit: 50, total, docs: pages[page - 1] ?? [] }));
  });
  const adapter = new KinopoiskDevAdapter(
    'https://api.poiskkino.dev',
    'private-key',
    { observe } as unknown as CatalogIdentityService,
    fetcher,
  );
  const search = (page: number, category = Category.Films, query = 'Fixture') =>
    adapter.search({
      provider: 'kinopoisk',
      category,
      locale: Locale.En,
      query,
      page,
      pageSize: 2,
    });

  return { search, observe, fetcher };
}

describe('Kinopoisk pagination', () => {
  it('retains lookahead rows across display and upstream page boundaries', async () => {
    const movies = Array.from({ length: 54 }, (_, index) => ({ id: index + 1, type: 'movie' }));
    const { search } = fixture([movies.slice(0, 50), movies.slice(50)], 54);

    for (const page of [1, 2, 25, 26, 27]) {
      const result = await search(page);
      expect(result.results.map((record) => record.catalogId)).toEqual([
        String(page * 2 - 1),
        String(page * 2),
      ]);
      expect(result.hasMore).toBe(page < 27);
      expect(result.total).toBeUndefined();
    }
  });

  it('looks beyond empty filtered pages for eligible continuation', async () => {
    const first = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, type: 'tv-series' }));
    first[49] = { id: 50, type: 'movie' };
    const second = Array.from({ length: 50 }, (_, index) => ({
      id: index + 51,
      type: 'tv-series',
    }));
    const { search } = fixture(
      [
        first,
        second,
        [
          { id: 151, type: 'movie' },
          { id: 152, type: 'movie' },
        ],
      ],
      102,
    );
    const result = await search(1);

    expect(result.results.map((record) => record.catalogId)).toEqual(['50', '151']);
    expect(result.hasMore).toBe(true);
    const last = await search(2);
    expect(last.results.map((record) => record.catalogId)).toEqual(['152']);
    expect(last.hasMore).toBe(false);
  });

  it('deduplicates title IDs before slicing display pages', async () => {
    const { search, observe } = fixture(
      [
        Array.from({ length: 50 }, () => ({ id: 1, type: 'movie' })),
        [
          { id: 1, type: 'movie' },
          { id: 2, type: 'movie' },
          { id: 3, type: 'movie' },
        ],
      ],
      53,
    );

    expect((await search(1)).results.map((record) => record.catalogId)).toEqual(['1', '2']);
    expect(observe).toHaveBeenCalledTimes(2);
    expect((await search(2)).results.map((record) => record.catalogId)).toEqual(['3']);
  });

  it('does not claim continuation from a mixed-category total', async () => {
    const { search } = fixture(
      [
        [
          { id: 1, type: 'movie' },
          { id: 2, type: 'movie' },
        ],
        [
          { id: 3, type: 'anime' },
          { id: 4, type: 'tv-series' },
        ],
      ],
      52,
    );

    expect(await search(1)).toMatchObject({ hasMore: false });
  });

  it('isolates repeated requests and category/query changes', async () => {
    const { search, fetcher } = fixture(
      [
        [
          { id: 1, type: 'cartoon' },
          { id: 2, type: 'animated-series' },
        ],
      ],
      2,
    );

    expect((await search(1)).results.map((record) => record.catalogId)).toEqual(['1']);
    expect(
      (await search(1, Category.Tv, 'Another')).results.map((record) => record.catalogId),
    ).toEqual(['2']);
    expect((await search(1)).results.map((record) => record.catalogId)).toEqual(['1']);
    expect(
      fetcher.mock.calls.every(
        ([input]) => new URL(String(input)).searchParams.get('page') === '1',
      ),
    ).toBe(true);
  });

  it('handles empty results, unknown totals and pages beyond the end', async () => {
    expect(await fixture([]).search(1)).toMatchObject({ results: [], hasMore: false });
    const { search } = fixture([[{ id: 1, type: 'movie' }]]);

    expect(await search(1)).toMatchObject({ hasMore: false });
    expect(await search(2)).toMatchObject({ results: [], hasMore: false });
  });

  it('excludes contradictory and unknown classifications while keeping TV results', async () => {
    const { search } = fixture([
      [
        { id: 1, type: 'tv-series', isSeries: false },
        { id: 2, type: 'anime' },
        { id: 3, type: 'unknown' },
        { id: 4, type: 'tv-series', isSeries: true },
        { id: 5, type: 'animated-series', isSeries: true },
      ],
    ]);

    expect((await search(1, Category.Tv)).results.map((record) => record.catalogId)).toEqual([
      '4',
      '5',
    ]);
  });

  it('bounds scanning and labels uncertain continuation explicitly', async () => {
    const pages = Array.from({ length: 20 }, (_, page) =>
      Array.from({ length: 50 }, (_, index) => ({
        id: page * 50 + index + 1,
        type: 'tv-series',
      })),
    );
    const { search, fetcher, observe } = fixture(pages, 2000);

    expect(await search(1)).toMatchObject({
      results: [],
      hasMore: false,
      limitation: 'lookahead-exhausted',
    });
    expect(fetcher).toHaveBeenCalledTimes(20);
    expect(observe).not.toHaveBeenCalled();
  });

  it('checks an exact full-page boundary when upstream omits total', async () => {
    const movies = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, type: 'movie' }));
    const { search, fetcher } = fixture([movies]);
    const result = await search(25);

    expect(result.results.map((record) => record.catalogId)).toEqual(['49', '50']);
    expect(result.hasMore).toBe(false);
    expect(result.limitation).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('applies the same pagination to structured discovery', async () => {
    const { search, fetcher } = fixture([
      [
        { id: 1, type: 'movie' },
        { id: 2, type: 'cartoon' },
        { id: 3, type: 'movie' },
      ],
    ]);
    const first = await search(1, Category.Films, '');
    const last = await search(2, Category.Films, '');
    const url = new URL(String(fetcher.mock.calls[0][0]));

    expect(first.results.map((record) => record.catalogId)).toEqual(['1', '2']);
    expect(first.hasMore).toBe(true);
    expect(last.results.map((record) => record.catalogId)).toEqual(['3']);
    expect(last.hasMore).toBe(false);
    expect(url.pathname).toBe('/v1.4/movie');
    expect(url.searchParams.getAll('type')).toEqual(['movie', 'cartoon']);
  });
});
