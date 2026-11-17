import {
  ApiErrorCode,
  Category,
  Format,
  Locale,
  type CatalogSearchRequest,
} from '@filecab/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogIdentityService } from './catalog-identity.service';
import { KinopoiskDevAdapter } from './kinopoisk-dev.adapter';

/** Supplies isolated provider responses and captures the metadata submitted for persistence. */
function fixture(...responses: unknown[]) {
  const observe = vi
    .fn<CatalogIdentityService['observe']>()
    .mockImplementation(async (category, granularity, snapshot) => ({
      schemaVersion: 1,
      catalogId: 'stable-id',
      category,
      granularity,
      snapshot,
    }));
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(JSON.stringify(responses.shift())));
  const adapter = new KinopoiskDevAdapter(
    'https://api.poiskkino.dev',
    'secret',
    { observe } as unknown as CatalogIdentityService,
    fetcher,
  );

  return { adapter, observe, fetcher };
}

/** Creates one bounded discovery request with optional operation controls. */
function request(overrides: Partial<CatalogSearchRequest> = {}) {
  return {
    provider: 'kinopoisk',
    category: Category.Films,
    query: '',
    page: 1,
    pageSize: 2,
    locale: Locale.En,
    ...overrides,
  };
}

describe('Kinopoisk normalization and reference contracts', () => {
  it('uses series URLs and real language tags without inventing original-title provenance', async () => {
    const { adapter, fetcher } = fixture({
      id: 7,
      type: 'tv-series',
      isSeries: true,
      name: 'Русское название',
      alternativeName: 'Alternative',
      description: 'Описание',
      names: [
        { name: 'English title', language: 'EN' },
        { name: 'Русское название', language: 'RU' },
        { name: 'Country alias', language: 'US' },
      ],
      poster: null,
      seasonsInfo: [
        { number: 1, episodesCount: 10 },
        { number: 1, episodesCount: 10 },
        { number: 3 },
      ],
    });
    const { snapshot } = await adapter.details('7', Locale.En);

    expect(snapshot.titles[0]).toMatchObject({ text: 'English title', language: 'en' });
    expect(snapshot.titles.find(({ text }) => text === 'Country alias')?.language).toBe('und');
    expect(snapshot.originalTitle).toBeNull();
    expect(snapshot.descriptions[0].language).toBe('und');
    expect(snapshot.references[0].provenance.source).toBe('https://www.kinopoisk.ru/series/7/');
    expect(snapshot).toMatchObject({
      format: Format.TvSeries,
      posterUrl: null,
      episodeCount: null,
      availableEpisodeCount: null,
    });
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.has('locale')).toBe(false);
  });

  it('falls back to available text and deduplicates provider genre names independently of slugs', async () => {
    const { adapter } = fixture(
      {
        id: 7,
        type: 'movie',
        alternativeName: 'Fallback',
        genres: [
          { name: ' Драма ', slug: 'drama' },
          { name: 'драма', slug: 'different' },
          { name: 'Unknown genre' },
        ],
      },
      { id: 8, type: 'movie', genres: [{ name: 'драма', slug: 'drama' }] },
    );
    const first = await adapter.details('7', Locale.Ru);
    const second = await adapter.details('8', Locale.En);

    expect(first.snapshot.titles[0]).toMatchObject({ text: 'Fallback', language: 'und' });
    expect(first.snapshot.genres).toHaveLength(2);
    expect(first.snapshot.genres[0].genreId).toBe(second.snapshot.genres[0].genreId);
    expect(first.snapshot.genres[0].labels[0].language).toBe('ru');
    expect(first.snapshot.genres[1].key).toBe('provider:kinopoisk:unknown genre');
    expect(first.snapshot.genres[1].labels[0].language).toBe('und');
  });

  it('omits unavailable scores and scores without a valid attribution ID', async () => {
    const { adapter } = fixture({
      id: 7,
      type: 'movie',
      rating: { kp: 0, imdb: 8, tmdb: 9 },
      externalId: { imdb: 'bad', tmdb: 0, kpHD: 'abcdef' },
    });
    const { snapshot } = await adapter.details('7', Locale.En);

    expect(snapshot.providerRatings).toEqual([]);
    expect(snapshot.references.map(({ namespace }) => namespace)).toEqual(['kinopoisk']);
  });

  it('preserves IMDb leading zeros and attributes positive scores to the correct titles', async () => {
    const { adapter } = fixture({
      id: 7,
      type: 'tv-series',
      rating: { kp: 8, imdb: 9, tmdb: 7.5 },
      externalId: { imdb: 'tt00042', tmdb: 42 },
    });
    const { snapshot } = await adapter.details('7', Locale.En);

    expect(snapshot.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ namespace: 'imdb', id: 'tt00042' }),
        expect.objectContaining({ namespace: 'tmdb', entity: 'tv', id: '42' }),
      ]),
    );
    expect(snapshot.providerRatings.map(({ provenance }) => provenance.source)).toEqual([
      'https://www.kinopoisk.ru/series/7/',
      'https://www.imdb.com/title/tt00042/',
      'https://www.themoviedb.org/tv/42',
    ]);
  });

  it.each([
    null,
    {},
    { url: '' },
    { url: 'https://' },
    { url: 'http://poster.test/a' },
    { url: 12 },
  ])('keeps unavailable or unsafe posters null: %j', async (poster) => {
    const { adapter } = fixture({ id: 7, type: 'movie', poster });

    expect((await adapter.details('7', Locale.En)).snapshot.posterUrl).toBeNull();
  });

  it('rejects a detail response with another title ID before persistence', async () => {
    const { adapter, observe } = fixture({ id: 8, type: 'movie' });

    await expect(adapter.details('7', Locale.En)).rejects.toMatchObject({
      code: ApiErrorCode.InvalidResponse,
    });
    expect(observe).not.toHaveBeenCalled();
  });

  it('revalidates the external reference on the fetched detail', async () => {
    const { adapter, observe } = fixture(
      {
        page: 1,
        limit: 2,
        total: 1,
        docs: [{ id: 7, type: 'movie', externalId: { imdb: 'tt00042' } }],
      },
      { id: 7, type: 'movie', externalId: { imdb: 'tt00043' } },
    );

    await expect(
      adapter.resolveReference('imdb', 'title', 'tt00042', Locale.En),
    ).rejects.toMatchObject({ code: ApiErrorCode.InvalidResponse });
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([
    ['kinopoisk', 'hd', 'abcdef'],
    ['imdb', 'title', ''],
    ['imdb', 'title', '123'],
    ['kinopoisk', 'title', ''],
  ])('rejects invalid references without an upstream search', async (namespace, entity, id) => {
    const { adapter, fetcher } = fixture();

    await expect(adapter.resolveReference(namespace, entity, id, Locale.En)).rejects.toMatchObject({
      httpStatus: 400,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('persists a verified exact IMDb lookup only after matching its detail', async () => {
    const movie = { id: 7, type: 'movie', externalId: { imdb: 'tt00042' } };
    const { adapter, fetcher, observe } = fixture(
      { page: 1, limit: 2, total: 1, docs: [movie] },
      movie,
    );
    const record = await adapter.resolveReference('imdb', 'title', 'tt00042', Locale.En);

    expect(record.catalogId).toBe('stable-id');
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('externalId.imdb')).toBe(
      'tt00042',
    );
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it.each([
    { docs: [], status: 404 },
    {
      docs: [
        { id: 7, type: 'movie', externalId: { imdb: 'tt00042' } },
        { id: 8, type: 'movie', externalId: { imdb: 'tt00042' } },
      ],
      status: 409,
    },
  ])('rejects missing or ambiguous external matches: $status', async ({ docs, status }) => {
    const { adapter, fetcher, observe } = fixture({ page: 1, limit: 2, docs });

    await expect(
      adapter.resolveReference('imdb', 'title', 'tt00042', Locale.En),
    ).rejects.toMatchObject({ httpStatus: status });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(observe).not.toHaveBeenCalled();
  });

  it.each([{ body: null }, { body: [] }, { body: 'invalid' }])(
    'maps malformed top-level responses to a structured error: %j',
    async ({ body }) => {
      const { adapter } = fixture(body);

      await expect(adapter.details('7', Locale.En)).rejects.toMatchObject({
        code: ApiErrorCode.InvalidResponse,
      });
    },
  );
});

describe('Kinopoisk operation-specific controls', () => {
  it('serializes discovery filters without an expensive secondary sort', async () => {
    const { adapter, fetcher } = fixture({ limit: 3, docs: [], hasNext: false });
    await adapter.search(
      request({
        filters: { year: 2014, format: 'movie', providerRating: '8-10' },
        order: 'rating-desc',
      }),
    );
    const url = new URL(String(fetcher.mock.calls[0][0]));

    expect(url.pathname).toBe('/v1.5/movie');
    expect(url.searchParams.get('year')).toBe('2014');
    expect(url.searchParams.getAll('type')).toEqual(['movie']);
    expect(url.searchParams.get('rating.kp')).toBe('8-10');
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp']);
    expect(url.searchParams.getAll('sortType')).toEqual(['-1']);
  });

  it.each([
    ['year-asc', 'year', '1'],
    ['year-desc', 'year', '-1'],
    ['rating-desc', 'rating.kp', '-1'],
  ])('sends only the supported primary sort for %s', async (order, field, direction) => {
    const { adapter, fetcher } = fixture({ limit: 3, docs: [], hasNext: false });
    await adapter.search(request({ order }));
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.getAll('sortField')).toEqual([field]);
    expect(url.searchParams.getAll('sortType')).toEqual([direction]);
  });

  it.each<Partial<CatalogSearchRequest>>([
    { query: 'title', filters: { year: 2014 } },
    { query: 'title', order: 'year-asc' },
    { filters: { genre: 'unknown' } },
    { order: 'personal-rating' },
    { order: 'rating-asc' },
  ])('rejects unsupported combinations before fetching: %j', async (options) => {
    const { adapter, fetcher } = fixture();

    await expect(adapter.search(request(options))).rejects.toMatchObject({ httpStatus: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
