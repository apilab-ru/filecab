import type { Genre, LocalizedText } from '@filecab/contracts';
import * as Sentry from '@sentry/nestjs';
import type { PrismaClient } from '../generated/prisma/client';

const PROVIDER_KEY = /^provider:([^:]+):(.+)$/;

const CACHE_TTL_MS = 10 * 60 * 1000;

/** Drops or merges provider genre IDs before the mapping lookup. */
interface ProviderGenreRules {
  ignored: ReadonlySet<string>;
  convert: Readonly<Record<string, string>>;
}

const PROVIDER_GENRE_RULES: Readonly<Record<string, ProviderGenreRules>> = {
  smotret: {
    // Award winners and adult cast describe a title, not its genre.
    ignored: new Set(['46', '50']),
    convert: {
      '54': '17', // Martial arts subgenre → martial arts
      '74': '22', // Romantic subtext → romance
      '77': '30', // Team sports → sports
      '79': '11', // Games → game
    },
  },
  kinopoisk: {
    // A ceremony is a broadcast format, not a genre.
    ignored: new Set(['церемония']),
    convert: {},
  },
};

const NO_RULES: ProviderGenreRules = { ignored: new Set(), convert: {} };

/** Builds the lookup key of one provider genre mapping. */
function mappingKey(namespace: string, externalId: string): string {
  return `${namespace}\u0000${externalId}`;
}

/** Describes one provider genre that has no internal mapping. */
interface UnmappedGenre {
  externalId: string;
  providerId: string;
  labels: string[];
}

/**
 * Replaces provider genres in catalog snapshots with internal genres from `GenreMapping`.
 * Internal genres pass through. An unmapped provider genre is removed and reported once.
 */
export class CatalogGenreResolver {
  private cache: { loadedAt: number; genres: Map<string, Genre> } | null = null;
  private readonly reported = new Set<string>();

  constructor(
    private readonly database: PrismaClient,
    private readonly now: () => number = Date.now,
  ) {}

  /** Returns internal genres for the snapshot genres without duplicates. */
  async resolve(genres: Genre[]): Promise<Genre[]> {
    if (!genres.some(({ key }) => PROVIDER_KEY.test(key))) return genres;

    const mapped = await this.mappings();
    const resolved = new Map<string, Genre>();
    const unmapped = new Map<string, UnmappedGenre[]>();

    for (const genre of genres) {
      const match = PROVIDER_KEY.exec(genre.key);

      if (!match) {
        resolved.set(genre.genreId, genre);
        continue;
      }

      const [, namespace, providerId] = match as unknown as [string, string, string];
      const rules = PROVIDER_GENRE_RULES[namespace] ?? NO_RULES;

      if (rules.ignored.has(providerId)) continue;

      const externalId = rules.convert[providerId] ?? providerId;
      const internal = mapped.get(mappingKey(namespace, externalId));

      if (internal) {
        resolved.set(internal.genreId, internal);
        continue;
      }

      unmapped.set(namespace, [
        ...(unmapped.get(namespace) ?? []),
        { externalId, providerId, labels: genre.labels.map(({ text }) => text) },
      ]);
    }

    for (const [namespace, genres] of unmapped) this.report(namespace, genres);

    return [...resolved.values()];
  }

  /** Reads all provider mappings once per cache period. */
  private async mappings(): Promise<Map<string, Genre>> {
    if (this.cache && this.now() - this.cache.loadedAt < CACHE_TTL_MS) return this.cache.genres;

    const rows = await this.database.genreMapping.findMany({ include: { genre: true } });
    const genres = new Map(
      rows.map(({ namespace, externalId, genre }) => [
        mappingKey(namespace, externalId),
        {
          genreId: genre.id,
          key: genre.key,
          labels: genre.labels as unknown as LocalizedText[],
        },
      ]),
    );
    this.cache = { loadedAt: this.now(), genres };

    return genres;
  }

  /** Reports new unmapped genres of one provider in one event, so that an operator can map them. */
  private report(namespace: string, genres: UnmappedGenre[]): void {
    const fresh = genres.filter(
      ({ externalId }) => !this.reported.has(mappingKey(namespace, externalId)),
    );

    if (!fresh.length) return;

    fresh.forEach(({ externalId }) => this.reported.add(mappingKey(namespace, externalId)));
    Sentry.withScope((scope) => {
      scope.setLevel('warning');
      scope.setTag('catalog.provider', namespace);
      // One issue per provider, while each event lists its own genres.
      scope.setFingerprint(['catalog-genre-mapping', namespace]);
      scope.setContext('unmappedGenres', {
        provider: namespace,
        count: fresh.length,
        genres: fresh.map(({ externalId, providerId, labels }) => ({
          externalId,
          ...(providerId === externalId ? {} : { providerId }),
          labels,
        })),
      });
      Sentry.captureMessage(
        `Catalog genres have no mapping for provider ${namespace}: ${fresh
          .map(({ externalId, labels }) => `${externalId} (${labels.join(', ')})`)
          .join('; ')}`,
      );
    });
  }
}
