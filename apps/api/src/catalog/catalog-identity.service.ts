import {
  ApiErrorCode,
  mergeCatalogSnapshots,
  type CatalogRecord,
  type Category,
  type Granularity,
  type Snapshot,
} from '@filecab/contracts';
import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { ApiException } from '../http/api-error';

/** Converts a domain value to JSON accepted by Prisma. */
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Detects retryable catalog identity races without exposing database details. */
function isIdentityRace(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

/** Persists stable catalog identities independently of owner-library documents. */
export class CatalogIdentityService {
  constructor(private readonly database: PrismaClient) {}

  /** Resolves verified identities and safely enriches the matching catalog record. */
  async observe(
    category: Category,
    granularity: Granularity,
    snapshot: Snapshot,
  ): Promise<CatalogRecord> {
    const references = [
      ...new Map(
        snapshot.references
          .filter((reference) => reference.provenance.verified)
          .map((reference) => [
            `${reference.namespace}\u0000${reference.entity}\u0000${reference.id}`,
            reference,
          ]),
      ).values(),
    ];

    if (!references.length || references.some((reference) => reference.granularity !== granularity))
      throw new ApiException(409, ApiErrorCode.Conflict, 'Verified catalog identity is required');

    return this.observeWithRetry(category, granularity, snapshot, references, 0);
  }

  /** Retries a uniqueness race after rolling back the failed transaction. */
  private async observeWithRetry(
    category: Category,
    granularity: Granularity,
    snapshot: Snapshot,
    references: Snapshot['references'],
    attempt: number,
  ): Promise<CatalogRecord> {
    try {
      return await this.database.$transaction(
        async (transaction) => {
          const known = await transaction.catalogReference.findMany({
            where: {
              OR: references.map(({ namespace, entity, id }) => ({
                namespace,
                entity,
                externalId: id,
              })),
            },
            include: { catalog: true },
          });
          const catalogIds = [...new Set(known.map((reference) => reference.catalogId))];

          if (catalogIds.length > 1)
            throw new ApiException(409, ApiErrorCode.Conflict, 'Catalog references conflict');

          const catalogId = catalogIds[0] ?? randomUUID();
          const current = known[0]?.catalog;

          if (current && (current.category !== category || current.granularity !== granularity))
            throw new ApiException(409, ApiErrorCode.Conflict, 'Catalog identity conflicts');

          const storedSnapshot = current
            ? mergeCatalogSnapshots(current.snapshot as unknown as Snapshot, snapshot)
            : snapshot;

          if (current) {
            await transaction.catalogItem.update({
              where: { id: catalogId },
              data: { snapshot: json(storedSnapshot) },
            });
          } else {
            await transaction.catalogItem.create({
              data: {
                id: catalogId,
                category,
                granularity,
                snapshot: json(storedSnapshot),
              },
            });
          }

          const knownKeys = new Set(
            known.map(
              (reference) =>
                `${reference.namespace}\u0000${reference.entity}\u0000${reference.externalId}`,
            ),
          );
          const additionalReferences = references.filter(
            (reference) =>
              !knownKeys.has(
                `${reference.namespace}\u0000${reference.entity}\u0000${reference.id}`,
              ),
          );

          if (additionalReferences.length)
            await transaction.catalogReference.createMany({
              data: additionalReferences.map((reference) => ({
                namespace: reference.namespace,
                entity: reference.entity,
                externalId: reference.id,
                catalogId,
                provenance: json(reference.provenance),
              })),
            });

          return {
            schemaVersion: 1,
            catalogId,
            category,
            granularity,
            snapshot: storedSnapshot,
          };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (!isIdentityRace(error) || attempt >= 2) throw error;

      return this.observeWithRetry(category, granularity, snapshot, references, attempt + 1);
    }
  }
}
