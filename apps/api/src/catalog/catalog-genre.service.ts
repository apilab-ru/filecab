import {
  ApiErrorCode,
  type Category,
  type GenreMappingConflict,
  type GenreMappingReview,
  type GenreRefreshResponse,
  type GenreReviewResponse,
  type GenreResponse,
  type LocalizedText,
  type Locale,
  type Provenance,
} from '@filecab/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';
import { CatalogGenreProviderResponseDto } from './catalog-genre.dto';

/** Supplies bounded, normalized provider genre data; provider payloads remain untrusted. */
export interface CatalogGenreAdapter {
  provider: string;
  namespace: string;
  /** Curated server-side crosswalks; canonical keys never come from provider payloads. */
  canonicalMappings: ReadonlyMap<string, string>;
  /** Enforces the byte limit while reading the provider body and honors abort. */
  fetchGenres(locale: Locale, signal: AbortSignal, maxResponseBytes: number): Promise<unknown>;
}

interface NormalizedGenreInput {
  externalId: string;
  canonicalKey?: string;
  labels: Array<{ language: string; text: string }>;
}

interface ProviderFailure {
  status?: number;
  retryAfterSeconds?: number;
}

/** Converts domain values to JSON accepted by Prisma without retaining prototypes. */
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Merges translated labels by actual language and preserves prior languages. */
function mergeLabels(previous: LocalizedText[], incoming: LocalizedText[]): LocalizedText[] {
  const labels = new Map(previous.map((label) => [label.language, label]));

  for (const label of incoming) labels.set(label.language, label);

  return [...labels.values()];
}

/** Reads only safe retry metadata from an adapter error. */
function providerFailure(error: unknown): ProviderFailure {
  if (error instanceof ApiException)
    return {
      status: error.httpStatus,
      retryAfterSeconds: error.retryAfterSeconds,
    };

  if (typeof error !== 'object' || error === null) return {};

  return {
    ...('status' in error && typeof error.status === 'number' ? { status: error.status } : {}),
    ...('retryAfterSeconds' in error && typeof error.retryAfterSeconds === 'number'
      ? { retryAfterSeconds: error.retryAfterSeconds }
      : {}),
  };
}

/** Delays a retry without exposing provider errors or response data. */
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Detects unique-key and serializable transaction races during genre administration. */
function isGenreRace(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

/** Rejects prototype keys and excessive nesting before class-transformer conversion. */
function hasUnsafeStructure(value: unknown, depth = 0): boolean {
  if (depth > 32) return true;

  if (Array.isArray(value)) return value.some((entry) => hasUnsafeStructure(entry, depth + 1));

  if (typeof value !== 'object' || value === null) return false;

  return Object.entries(value).some(
    ([key, entry]) =>
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      hasUnsafeStructure(entry, depth + 1),
  );
}

/** Validates, budgets, and persists provider genre refreshes and operator review data. */
export class CatalogGenreService {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly database: PrismaClient,
    private readonly environment: ApiEnvironment['catalog'],
    private readonly adapters: readonly CatalogGenreAdapter[] = [],
  ) {}

  /** Returns stable internal genres without mutating provider mappings during GET. */
  async publicGenres(locale: Locale): Promise<GenreResponse> {
    const records = await this.database.genre.findMany({
      include: { mappings: true, categories: true },
      orderBy: { key: 'asc' },
    });
    const genres = records
      .filter(
        (record) =>
          !record.key.startsWith('provider:') ||
          record.mappings.some((mapping) => (mapping.provenance as unknown as Provenance).verified),
      )
      .map((record) => ({
        genreId: record.id,
        key: record.key,
        labels: record.labels as unknown as LocalizedText[],
        categories: record.categories.map((category) => category.category as Category),
      }));

    return { schemaVersion: 1, locale, genres };
  }

  /** Refreshes one active provider and records unresolved mappings for operator review. */
  async refresh(provider: string, locale: Locale): Promise<GenreRefreshResponse> {
    const adapter = this.adapters.find((candidate) => candidate.provider === provider);

    if (!adapter)
      throw new ApiException(
        503,
        ApiErrorCode.ProviderUnavailable,
        'Selected catalog genre provider is unavailable',
        true,
      );

    const release = await this.acquire();

    try {
      const raw = await this.fetchWithBudget(adapter, locale);
      const genres = this.validateResponse(raw, adapter);

      return await this.persistWithRetry(adapter, locale, genres, 0);
    } finally {
      release();
    }
  }

  /** Lists unverified mappings and unresolved conflicts without mutating their status. */
  async review(provider?: string): Promise<GenreReviewResponse> {
    const where = provider ? { namespace: provider } : undefined;
    const mappings = await this.database.genreMapping.findMany({
      where,
      include: { genre: true },
      orderBy: [{ namespace: 'asc' }, { externalId: 'asc' }],
    });
    const conflicts = await this.database.genreMappingConflict.findMany({
      where: { ...(where ?? {}), reviewedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      schemaVersion: 1,
      mappings: mappings
        .filter((mapping) => !(mapping.provenance as unknown as Provenance).verified)
        .map((mapping) => ({
          provider: mapping.namespace,
          externalId: mapping.externalId,
          genreId: mapping.genreId,
          labels: mapping.genre.labels as unknown as LocalizedText[],
          provenance: mapping.provenance as unknown as Provenance,
          verified: false,
        })),
      conflicts: conflicts.map((conflict) => this.conflictModel(conflict)),
    };
  }

  /** Enforces a bounded concurrent refresh queue per API instance. */
  private async acquire(): Promise<() => void> {
    const maxQueued = this.environment.budgets.concurrency * 4;
    let queued = false;

    if (this.active >= this.environment.budgets.concurrency && this.waiters.length >= maxQueued)
      throw new ApiException(429, ApiErrorCode.RateLimited, 'Genre refresh capacity is full', true);

    if (this.active >= this.environment.budgets.concurrency) {
      queued = true;
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    if (!queued) this.active += 1;

    let released = false;

    return () => {
      if (released) return;

      released = true;
      const next = this.waiters.shift();

      if (next) next();
      else this.active -= 1;
    };
  }

  /** Retries transient provider failures within timeout and Retry-After budgets. */
  private async fetchWithBudget(adapter: CatalogGenreAdapter, locale: Locale): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.environment.budgets.retries; attempt += 1) {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;

      try {
        return await Promise.race([
          adapter.fetchGenres(locale, controller.signal, this.environment.budgets.maxResponseBytes),
          new Promise<never>((_resolve, reject) => {
            timeout = setTimeout(() => {
              controller.abort();
              reject(
                new ApiException(
                  504,
                  ApiErrorCode.TransportError,
                  'Genre provider timed out',
                  true,
                ),
              );
            }, this.environment.budgets.timeoutMs);
          }),
        ]);
      } catch (error) {
        lastError = error;
        const failure = providerFailure(error);
        const transient =
          failure.status === undefined || [429, 502, 503, 504].includes(failure.status);

        if (!transient || attempt >= this.environment.budgets.retries) break;

        const retryAfter = failure.retryAfterSeconds;

        if (retryAfter !== undefined) {
          if (
            !Number.isSafeInteger(retryAfter) ||
            retryAfter < 0 ||
            retryAfter > this.environment.budgets.maxRetryAfterSeconds
          )
            throw new ApiException(
              429,
              ApiErrorCode.RateLimited,
              'Genre provider retry delay exceeds the configured budget',
              true,
              undefined,
              retryAfter,
            );

          await wait(retryAfter * 1000);
        } else {
          await wait(Math.min(2000, 100 * 2 ** attempt));
        }
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }

    const failure = providerFailure(lastError);

    if (failure.status === 429)
      throw new ApiException(
        429,
        ApiErrorCode.RateLimited,
        'Genre provider is rate limited',
        true,
        undefined,
        failure.retryAfterSeconds,
      );

    if (failure.status === 504)
      throw new ApiException(504, ApiErrorCode.TransportError, 'Genre provider timed out', true);

    throw new ApiException(
      503,
      ApiErrorCode.ProviderUnavailable,
      'Genre provider could not be reached',
      true,
    );
  }

  /** Rejects malformed, oversized, duplicate or unsupported provider genre responses. */
  private validateResponse(raw: unknown, adapter: CatalogGenreAdapter): NormalizedGenreInput[] {
    let serialized: string;

    try {
      serialized = JSON.stringify(raw);
    } catch {
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Genre provider response was invalid',
      );
    }

    if (
      serialized === undefined ||
      Buffer.byteLength(serialized, 'utf8') > this.environment.budgets.maxResponseBytes
    )
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Genre provider response was too large',
      );

    if (hasUnsafeStructure(raw))
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Genre provider response was invalid',
      );

    const response = plainToInstance(CatalogGenreProviderResponseDto, raw);
    const errors = validateSync(response, { whitelist: true, forbidNonWhitelisted: true });

    if (errors.length || response.genres.length > this.environment.budgets.maxGenres)
      throw new ApiException(
        502,
        ApiErrorCode.InvalidResponse,
        'Genre provider response was invalid',
      );

    const ids = new Set<string>();

    for (const genre of response.genres) {
      if (!genre.externalId.trim() || ids.has(genre.externalId))
        throw new ApiException(
          502,
          ApiErrorCode.InvalidResponse,
          'Genre provider response was invalid',
        );

      if (genre.labels.some((label) => !label.language.trim() || !label.text.trim()))
        throw new ApiException(
          502,
          ApiErrorCode.InvalidResponse,
          'Genre provider response was invalid',
        );

      ids.add(genre.externalId);
    }

    return response.genres.map((genre) => ({
      ...genre,
      canonicalKey: adapter.canonicalMappings.get(genre.externalId),
    }));
  }

  /** Retries stable genre-key races after rolling back the serializable transaction. */
  private async persistWithRetry(
    adapter: CatalogGenreAdapter,
    locale: Locale,
    input: NormalizedGenreInput[],
    attempt: number,
  ): Promise<GenreRefreshResponse> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const now = new Date();
          const provenance: Provenance = {
            source: adapter.provider,
            retrievedAt: now.toISOString(),
            verified: true,
          };
          const labelsById = new Map<string, LocalizedText[]>();
          const conflicts: GenreMappingConflict[] = [];
          let imported = 0;
          let unresolved = 0;

          for (const item of input) {
            const labels = item.labels.map((label) => ({ ...label, provenance }));
            const mapping = await transaction.genreMapping.findUnique({
              where: {
                namespace_externalId: {
                  namespace: adapter.namespace,
                  externalId: item.externalId,
                },
              },
              include: { genre: true },
            });

            if (item.canonicalKey) {
              const target = await transaction.genre.findUnique({
                where: { key: item.canonicalKey },
              });

              if (!target) {
                const conflict = await this.recordConflict(transaction, {
                  adapter,
                  item,
                  mapping,
                  labels,
                  provenance,
                  reason: 'target-missing',
                  now,
                });

                conflicts.push(conflict);
                unresolved += 1;
                continue;
              }

              if (mapping && mapping.genreId !== target.id) {
                const conflict = await this.recordConflict(transaction, {
                  adapter,
                  item,
                  mapping,
                  labels,
                  provenance,
                  reason: 'mapping-change',
                  now,
                });

                conflicts.push(conflict);
                unresolved += 1;
                continue;
              }

              await transaction.genreMapping.upsert({
                where: {
                  namespace_externalId: {
                    namespace: adapter.namespace,
                    externalId: item.externalId,
                  },
                },
                create: {
                  namespace: adapter.namespace,
                  externalId: item.externalId,
                  genreId: target.id,
                  provenance: json(provenance),
                },
                update: { provenance: json(provenance) },
              });
              labelsById.set(target.id, mergeLabels(labelsById.get(target.id) ?? [], labels));
              imported += 1;
              continue;
            }

            if (mapping) {
              labelsById.set(
                mapping.genreId,
                mergeLabels(labelsById.get(mapping.genreId) ?? [], labels),
              );
              imported += 1;

              if (!(mapping.provenance as unknown as Provenance).verified) unresolved += 1;

              continue;
            }

            const key = `provider:${adapter.namespace}:${item.externalId}`;
            let candidate = await transaction.genre.findUnique({ where: { key } });

            if (!candidate)
              candidate = await transaction.genre.create({
                data: { id: randomUUID(), key, labels: json(labels) },
              });

            await transaction.genreMapping.create({
              data: {
                namespace: adapter.namespace,
                externalId: item.externalId,
                genreId: candidate.id,
                provenance: json({ ...provenance, verified: false }),
              },
            });
            labelsById.set(candidate.id, mergeLabels(labelsById.get(candidate.id) ?? [], labels));
            imported += 1;
            unresolved += 1;
          }

          for (const [genreId, labels] of labelsById) {
            const genre = await transaction.genre.findUniqueOrThrow({ where: { id: genreId } });
            const current = genre.labels as unknown as LocalizedText[];

            await transaction.genre.update({
              where: { id: genreId },
              data: { labels: json(mergeLabels(current, labels)) },
            });
          }

          return {
            schemaVersion: 1,
            provider: adapter.provider,
            locale,
            imported,
            unresolved,
            conflicts,
          };
        },
        {
          isolationLevel: 'Serializable',
          maxWait: this.environment.budgets.timeoutMs,
          timeout: this.environment.budgets.timeoutMs * 4,
        },
      );
    } catch (error) {
      if (!isGenreRace(error) || attempt >= 2) throw error;

      return this.persistWithRetry(adapter, locale, input, attempt + 1);
    }
  }

  /** Upserts an unresolved mapping proposal while preserving the active mapping. */
  private async recordConflict(
    transaction: Prisma.TransactionClient,
    args: {
      adapter: CatalogGenreAdapter;
      item: NormalizedGenreInput;
      mapping: { genreId: string } | null;
      labels: LocalizedText[];
      provenance: Provenance;
      reason: GenreMappingConflict['reason'];
      now: Date;
    },
  ): Promise<GenreMappingConflict> {
    const { adapter, item, mapping, labels, provenance, reason, now } = args;
    const existing = await transaction.genreMappingConflict.findFirst({
      where: {
        namespace: adapter.namespace,
        externalId: item.externalId,
        proposedKey: item.canonicalKey ?? '',
        reason,
        reviewedAt: null,
      },
    });
    const data = {
      namespace: adapter.namespace,
      externalId: item.externalId,
      proposedKey: item.canonicalKey ?? '',
      currentGenreId: mapping?.genreId ?? null,
      labels: json(labels),
      provenance: json(provenance),
      reason,
      createdAt: now,
      reviewedAt: null,
    };
    const conflict = existing
      ? await transaction.genreMappingConflict.update({
          where: { id: existing.id },
          data,
        })
      : await transaction.genreMappingConflict.create({ data: { id: randomUUID(), ...data } });

    return this.conflictModel(conflict);
  }

  /** Converts Prisma conflict storage to the public shared model. */
  private conflictModel(conflict: {
    id: string;
    namespace: string;
    externalId: string;
    currentGenreId: string | null;
    proposedKey: string;
    labels: Prisma.JsonValue;
    provenance: Prisma.JsonValue;
    reason: string;
    createdAt: Date;
  }): GenreMappingConflict {
    return {
      conflictId: conflict.id,
      provider: conflict.namespace,
      externalId: conflict.externalId,
      currentGenreId: conflict.currentGenreId,
      proposedKey: conflict.proposedKey,
      labels: conflict.labels as unknown as LocalizedText[],
      provenance: conflict.provenance as unknown as Provenance,
      reason: conflict.reason as GenreMappingConflict['reason'],
      createdAt: conflict.createdAt.toISOString(),
    };
  }
}
