import { ApiErrorCode, Locale } from '@filecab/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnvironment } from '../config/environment';
import { SmotretAnimeAdapter } from './smotret-anime.adapter';

const origin = 'https://smotret-anime.online';
const environment = {
  budgets: {
    timeoutMs: 100,
    maxResponseBytes: 100_000,
    maxGenres: 20,
    concurrency: 2,
    retries: 0,
    maxRetryAfterSeconds: 10,
  },
} as ApiEnvironment['catalog'];

/** Builds a minimal provider series fixture with selective optional metadata. */
function series(id: number, values: Record<string, unknown> = {}) {
  return { id, titles: { en: `Series ${id}` }, ...values };
}

/** Creates an adapter whose fetch and persistence boundaries are observable. */
function fixture(fetcher: typeof fetch) {
  const observed: Array<Record<string, any>> = [];
  const identity = {
    observe: vi.fn(async (_category, _granularity, snapshot) => {
      observed.push(snapshot);

      return { id: `catalog-${observed.length}`, snapshot } as any;
    }),
  };
  const adapter = new SmotretAnimeAdapter(
    origin,
    environment,
    identity as any,
    'Filecab test fixture',
    fetcher,
  );

  return { adapter, identity, observed };
}

/** Returns a JSON response matching the public Smotret API envelope. */
function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('SmotretAnimeAdapter fixtures', () => {
  it('handles missing optional arrays and keeps provider references namespaced', async () => {
    const { adapter, observed } = fixture(async () =>
      jsonResponse({
        data: [
          series(12, { myAnimeListId: 12, links: [{ url: 'https://shikimori.io/animes/12' }] }),
        ],
      }),
    );

    await adapter.search({
      provider: 'smotret',
      category: 'anime',
      locale: Locale.En,
      query: 'fixture',
      page: 1,
      pageSize: 10,
      filters: {},
    } as any);

    expect(observed[0].titles).toEqual([
      { text: 'Series 12', language: 'en', provenance: expect.any(Object) },
    ]);
    expect(observed[0].episodeCount).toBeNull();
    expect(observed[0].availableEpisodeCount).toBeNull();
    expect(
      observed[0].references.map(({ namespace, id, provenance }: any) => [
        namespace,
        id,
        provenance.verified,
      ]),
    ).toEqual([
      ['smotret', '12', true],
      ['myanimelist', '12', false],
      ['shikimori', '12', false],
    ]);
  });

  it('uses offset pagination and bounded lookahead after identity deduplication', async () => {
    let requestedUrl = '';
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = String(input);

      return jsonResponse({ data: [series(1), series(1), series(2)] });
    };
    const { adapter, observed } = fixture(fetcher);

    const result = await adapter.search({
      provider: 'smotret',
      category: 'anime',
      locale: Locale.Ru,
      query: '',
      page: 3,
      pageSize: 2,
      filters: { year: 2024 },
      order: 'id',
    } as any);

    const requestUrl = new URL(requestedUrl);
    expect(requestUrl.searchParams.get('offset')).toBe('4');
    expect(requestUrl.searchParams.get('limit')).toBe('3');
    expect(requestUrl.searchParams.get('year')).toBe('2024');
    expect(result.results).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(observed).toHaveLength(2);
  });

  it('counts only listed narrative episodes and retains declared totals when arrays are incomplete', async () => {
    const { adapter, observed } = fixture(async () =>
      jsonResponse({
        data: series(21, {
          numberOfEpisodes: 24,
          episodes: [
            { id: 1, episodeType: 'tv', seriesId: 21 },
            { id: 2, episodeType: 'translation', seriesId: 21 },
            { id: 3, episodeType: 'tv', seriesId: 999 },
          ],
        }),
      }),
    );

    await adapter.details('21', Locale.En);

    expect(observed[0].episodeCount).toBe(24);
    expect(observed[0].availableEpisodeCount).toBe(1);
  });

  it('does not invent continuation when a valid empty page is returned', async () => {
    const { adapter } = fixture(async () => jsonResponse({ data: [] }));

    const result = await adapter.search({
      provider: 'smotret',
      category: 'anime',
      locale: Locale.En,
      query: 'missing',
      page: 1,
      pageSize: 10,
      filters: {},
    } as any);

    expect(result).toMatchObject({ results: [], hasMore: false });
  });

  it.each([
    ['throttling', 429, ApiErrorCode.RateLimited],
    ['denial', 403, ApiErrorCode.ProviderUnavailable],
  ])('maps %s to its structured provider error', async (_name, status, code) => {
    const { adapter } = fixture(async () => jsonResponse({}, Number(status)));

    await expect(adapter.details('1', Locale.En)).rejects.toMatchObject({
      code,
    });
  });
});
