import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
  Category,
  Granularity,
  emptySnapshot,
  type LibraryMutationPreview,
  type ServerEntry,
  type CatalogAssociationRequest,
} from '../../packages/contracts/src/index';
import { createDatabaseClient } from '../../apps/api/src/database/client';
import { validateEnvironment } from '../../apps/api/src/config/environment';
import { LibraryMutationService } from '../../apps/api/src/library/mutation.service';
import { LibraryPreviewSigner } from '../../apps/api/src/library/preview';

const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
});
const database = createDatabaseClient(environment.databaseUrl);
const service = new LibraryMutationService(
  database,
  new LibraryPreviewSigner('isolated-test-preview-key'),
);
const ownerId = randomUUID();
const otherOwner = randomUUID();
const catalogIds: string[] = [];

beforeAll(async () => {
  await database.user.createMany({
    data: [
      { id: ownerId, googleSubject: ownerId },
      { id: otherOwner, googleSubject: otherOwner },
    ],
  });
  await database.userLibrary.createMany({ data: [{ ownerId }, { ownerId: otherOwner }] });
});
afterAll(async () => {
  await database.user.deleteMany({ where: { id: { in: [ownerId, otherOwner] } } });
  await database.catalogItem.deleteMany({ where: { id: { in: catalogIds } } });
  await database.$disconnect();
});

/** Creates canonical catalog metadata without a provider dependency. */
async function catalog(category = Category.Films) {
  const id = randomUUID();
  catalogIds.push(id);
  await database.catalogItem.create({
    data: {
      id,
      category,
      granularity: Granularity.Film,
      snapshot: JSON.parse(JSON.stringify({ ...emptySnapshot(), year: 2020 })),
    },
  });

  return id;
}

/** Creates manual or catalog entries with distinct source ownership and private fields. */
async function create(catalogId: string | null = null) {
  const id = randomUUID();

  return service.create(ownerId, {
    entryId: id,
    category: Category.Films,
    catalogId,
    snapshot: emptySnapshot(),
    fields: {
      userTitle: '  My title  ',
      comment: '  Private note  ',
      rating: 8,
      progress: 12,
      sourceUrls: [`https://watch.test/${id}`],
    },
  });
}

/** Supplies only the version-bound association fields accepted at the API boundary. */
function request(
  entry: ServerEntry,
  catalogId: string,
  donor?: ServerEntry,
): CatalogAssociationRequest {
  return {
    entryId: entry.entryId,
    expectedVersion: entry.serverVersion,
    catalogId,
    fields: {},
    ...(donor ? { mergeEntryId: donor.entryId, mergeExpectedVersion: donor.serverVersion } : {}),
  };
}

test('merge commits donor deletion and keeps the latest viewing link in one transaction', async () => {
  const catalogId = await catalog();
  const manual = await create();
  const donor = await create(catalogId);
  const input = {
    ...request(manual, catalogId, donor),
    fields: { comment: 'Chosen donor note', rating: 0 },
  };
  const preview = (await service.associate(ownerId, input)) as LibraryMutationPreview;
  const [survivor, tombstone] = (await service.associate(
    ownerId,
    input,
    preview.previewToken,
  )) as ServerEntry[];
  expect(survivor).toMatchObject({
    entryId: manual.entryId,
    createdAt: manual.createdAt,
    userTitle: manual.userTitle,
    comment: 'Chosen donor note',
    progress: manual.progress,
    rating: 0,
    sources: donor.sources,
    catalogId,
  });
  expect(tombstone?.deleted).toBe(true);
  expect(BigInt(survivor!.serverVersion)).toBeGreaterThan(BigInt(tombstone!.serverVersion));
  expect(
    await database.sourceAssociation.findMany({ where: { ownerId, entryId: survivor!.entryId } }),
  ).toHaveLength(1);
  expect(
    await database.sourceAssociation.count({ where: { ownerId, entryId: donor.entryId } }),
  ).toBe(0);
});

test('stale previews, category changes and cross-owner access do not mutate entries', async () => {
  const manual = await create();
  const catalogId = await catalog();
  const input = request(manual, catalogId);
  const preview = (await service.associate(ownerId, input)) as LibraryMutationPreview;
  const latest = await service.update(ownerId, manual.entryId, manual.serverVersion, {
    progress: 42,
  });
  await expect(service.associate(ownerId, input, preview.previewToken)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  await expect(service.associate(otherOwner, input)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    service.associate(ownerId, request(latest, await catalog(Category.Tv))),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(await service.get(ownerId, manual.entryId)).toEqual(latest);
});

test('missing donor and metadata changes invalidate association confirmation', async () => {
  const catalogId = await catalog();
  const manual = await create();
  const donor = await create(catalogId);
  await expect(service.associate(ownerId, request(manual, catalogId))).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  const input = request(manual, catalogId, donor);
  const preview = (await service.associate(ownerId, input)) as LibraryMutationPreview;
  await database.catalogItem.update({
    where: { id: catalogId },
    data: { snapshot: JSON.parse(JSON.stringify({ ...emptySnapshot(), year: 2021 })) },
  });
  await expect(service.associate(ownerId, input, preview.previewToken)).rejects.toMatchObject({
    code: 'CONFLICT',
  });
  expect(await service.get(ownerId, manual.entryId)).toEqual(manual);
  expect(await service.get(ownerId, donor.entryId)).toEqual(donor);
});
