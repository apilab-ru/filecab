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
