import type { Genre } from '@filecab/contracts';
import * as Sentry from '@sentry/nestjs';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client';
import { CatalogGenreResolver } from './catalog-genre-resolver';

const scope = { setLevel: vi.fn(), setTag: vi.fn(), setContext: vi.fn(), setFingerprint: vi.fn() };

vi.mock('@sentry/nestjs', () => ({
  captureMessage: vi.fn(),
  withScope: (callback: (value: typeof scope) => void) => callback(scope),
}));

const provenance = { source: 'fixture', retrievedAt: '2026-11-19T00:00:00.000Z', verified: true };

/** Builds a provider genre as an adapter sends it. */
function provider(namespace: string, id: string, text = id): Genre {
  return {
    genreId: `${namespace}-${id}`,
    key: `provider:${namespace}:${id}`,
    labels: [{ text, language: 'und', provenance }],
  };
}

/** Creates a resolver over fixed `GenreMapping` rows. */
function resolver() {
  const genre = (id: string, key: string) => ({
    id,
    key,
    labels: [{ text: key, language: 'ru', provenance }],
  });
  const findMany = vi.fn().mockResolvedValue([
    { namespace: 'smotret', externalId: '17', genre: genre('martial-id', 'martial-arts') },
    { namespace: 'smotret', externalId: '4', genre: genre('comedy-id', 'comedy') },
    { namespace: 'kinopoisk', externalId: 'комедия', genre: genre('comedy-id', 'comedy') },
  ]);

  return {
    findMany,
    resolver: new CatalogGenreResolver({ genreMapping: { findMany } } as unknown as PrismaClient),
  };
}

describe('catalog genre resolver', () => {
  it('maps provider genres to internal genres after ignore and convert rules', async () => {
    const { resolver: genres } = resolver();
    const internal: Genre = { genreId: 'drama-id', key: 'drama', labels: [] };

    const result = await genres.resolve([
      provider('smotret', '54'),
      provider('smotret', '46'),
      provider('smotret', '4'),
      provider('kinopoisk', 'комедия'),
      internal,
    ]);

    expect(result.map(({ key }) => key)).toEqual(['martial-arts', 'comedy', 'drama']);
  });

  it('removes unmapped provider genres and reports them once for each provider', async () => {
    const { resolver: genres, findMany } = resolver();
    const unknown = [provider('smotret', '998', 'Первый'), provider('smotret', '999', 'Второй')];

    expect(await genres.resolve([...unknown, provider('smotret', '4')])).toHaveLength(1);
    expect(await genres.resolve(unknown)).toHaveLength(0);
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Catalog genres have no mapping for provider smotret: 998 (Первый); 999 (Второй)',
    );
    expect(scope.setTag).toHaveBeenCalledWith('catalog.provider', 'smotret');
    expect(scope.setContext).toHaveBeenCalledWith('unmappedGenres', {
      provider: 'smotret',
      count: 2,
      genres: [
        { externalId: '998', labels: ['Первый'] },
        { externalId: '999', labels: ['Второй'] },
      ],
    });
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
