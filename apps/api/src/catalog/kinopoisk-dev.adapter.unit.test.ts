import { Category, Locale } from '@filecab/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogIdentityService } from './catalog-identity.service';
import { KinopoiskDevAdapter } from './kinopoisk-dev.adapter';

describe('Kinopoisk provider failure diagnostics', () => {
  it('accepts numeric release years in search and details and persists the normalized year', async () => {
    const movie = { id: 1, type: 'movie', isSeries: false, name: 'Fixture', year: 2001 };
    const observe = vi
      .fn<CatalogIdentityService['observe']>()
      .mockImplementation(async (category, granularity, snapshot) => ({
        schemaVersion: 1,
        catalogId: 'catalog-fixture',
        category,
        granularity,
        snapshot,
      }));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, limit: 50, total: 1, docs: [movie] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(movie)));
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      { observe } as unknown as CatalogIdentityService,
      fetcher,
    );
    const search = await adapter.search({
      provider: 'kinopoisk',
      category: Category.Films,
      locale: Locale.En,
      query: 'Fixture',
      page: 1,
      pageSize: 1,
    });
    const detail = await adapter.details('1', Locale.En);

    expect(search.results[0].snapshot.year).toBe(2001);
    expect(detail.snapshot.year).toBe(2001);
    expect(observe).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed release years before persistence', async () => {
    const observe = vi.fn<CatalogIdentityService['observe']>();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          type: 'movie',
          year: 'invalid-year',
        }),
      ),
    );
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      { observe } as unknown as CatalogIdentityService,
      fetcher,
    );

    await expect(adapter.details('1', Locale.En)).rejects.toMatchObject({
      safeMessage: 'Kinopoisk returned an invalid catalog response',
    });
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'Kinopoisk credentials were rejected'],
    [403, 'Kinopoisk access or quota was denied'],
    [429, 'Kinopoisk API rate limit was reached'],
    [503, 'Kinopoisk API returned an unsuccessful response'],
  ])('preserves upstream HTTP %s without credentials or query text', async (status, message) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      {} as CatalogIdentityService,
      fetcher,
    );

    await expect(adapter.details('1', Locale.En)).rejects.toMatchObject({
      safeMessage: message,
      providerDiagnostic: {
        provider: 'kinopoisk',
        origin: 'https://api.poiskkino.dev',
        operation: 'details',
        stage: 'http',
        upstreamStatus: status,
      },
    });
  });

  it('keeps a DNS error code while discarding the raw network exception', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new TypeError('private network details', { cause: { code: 'ENOTFOUND' } }),
      );
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      {} as CatalogIdentityService,
      fetcher,
    );

    await expect(adapter.details('1', Locale.En)).rejects.toMatchObject({
      safeMessage: 'Kinopoisk API connection failed',
      providerDiagnostic: { stage: 'transport', networkCode: 'ENOTFOUND' },
      cause: undefined,
    });
  });
});

describe('Kinopoisk unknown release years', () => {
  it('normalizes zero years in details and retains a TV match across mixed search pages', async () => {
    const observe = vi
      .fn<CatalogIdentityService['observe']>()
      .mockImplementation(async (category, granularity, snapshot) => ({
        schemaVersion: 1,
        catalogId: snapshot.references[0].id,
        category,
        granularity,
        snapshot,
      }));
    const first = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      type: 'movie',
      year: 2020,
    }));
    const unknown = { id: 51, type: 'movie', year: 0 };
    const series = {
      id: 52,
      type: 'tv-series',
      isSeries: true,
      name: 'Fixture series',
      year: 2023,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 1, limit: 50, total: 52, docs: first })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ page: 2, limit: 50, total: 52, docs: [unknown, series] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(unknown)));
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      { observe } as unknown as CatalogIdentityService,
      fetcher,
    );
    const response = await adapter.search({
      provider: 'kinopoisk',
      category: Category.Tv,
      locale: Locale.Ru,
      query: 'Fixture series',
      page: 1,
      pageSize: 12,
    });
    expect(response.results).toHaveLength(1);
    expect(response.results[0].snapshot.year).toBe(2023);
    expect(response.results[0].category).toBe(Category.Tv);
    expect((await adapter.details('51', Locale.Ru)).snapshot.year).toBeNull();
  });

  it('accepts a title or genre without a name and attaches the invalid search item', async () => {
    // A real response item (id 647836): one `names` entry has no `name`.
    const nameless = {
      id: 647836,
      type: 'movie',
      year: 2014,
      name: '$50 и девушки по вызову: Любовная история',
      names: [
        { language: 'EN', type: 'Original title on tmdb' },
        { language: 'RU', name: '$50 и девушки по вызову: Любовная история' },
      ],
      genres: [{ name: null }, { name: 'драма' }],
    };
    const observe = vi
      .fn<CatalogIdentityService['observe']>()
      .mockImplementation(async (category, granularity, snapshot) => ({
        schemaVersion: 1,
        catalogId: 'catalog-fixture',
        category,
        granularity,
        snapshot,
      }));
    const invalid = { id: 0, type: 'movie' };
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      { observe } as unknown as CatalogIdentityService,
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ page: 1, limit: 50, total: 1, docs: [nameless] })),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ page: 1, limit: 50, total: 2, docs: [nameless, invalid] })),
        ),
    );
    const request = {
      provider: 'kinopoisk',
      category: Category.Films,
      locale: Locale.Ru,
      query: 'Пятьдесят оттенков черного',
      page: 1,
      pageSize: 20,
    };

    const { results } = await adapter.search(request);
    expect(results[0]!.snapshot.titles.map((title) => title.text)).toEqual([
      '$50 и девушки по вызову: Любовная история',
    ]);
    expect(results[0]!.snapshot.genres).toHaveLength(1);
    await expect(adapter.search(request)).rejects.toMatchObject({
      providerDiagnostic: {
        operation: 'search',
        stage: 'schema',
        validationFields: ['docs.1.id'],
        responseExcerpt: JSON.stringify(invalid),
      },
    });
  });

  it('attaches bounded field paths and a trimmed excerpt to rejected provider schema data', async () => {
    const adapter = new KinopoiskDevAdapter(
      'https://api.poiskkino.dev',
      'private-key',
      {} as CatalogIdentityService,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ id: 1, type: 'movie', year: -1, description: 'private-payload' }),
          ),
        ),
    );
    await expect(adapter.details('1', Locale.En)).rejects.toMatchObject({
      providerDiagnostic: {
        provider: 'kinopoisk',
        operation: 'details',
        stage: 'schema',
        validationFields: ['year'],
        responseExcerpt: expect.stringContaining('"year":-1'),
      },
    });
  });
});
