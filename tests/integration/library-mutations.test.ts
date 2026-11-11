import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { Category, Status, emptySnapshot } from '../../packages/contracts/src/index';
import { createDatabaseClient } from '../../apps/api/src/database/client';
import { validateEnvironment } from '../../apps/api/src/config/environment';
import { LibraryMutationService } from '../../apps/api/src/library/mutation.service';

const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
});
const database = createDatabaseClient(environment.databaseUrl);
const service = new LibraryMutationService(database);
const owners: string[] = [randomUUID(), randomUUID()];

beforeAll(async () => {
  await Promise.all(
    owners.map((id) =>
      database.user.create({ data: { id, googleSubject: id, library: { create: {} } } }),
    ),
  );
});
afterAll(async () => {
  await database.user.deleteMany({ where: { id: { in: owners } } });
  await database.$disconnect();
});

/** Creates a manual item for isolated transaction scenarios. */
function create(owner: string = owners[0], urls: string[] = []) {
  return service.create(owner, {
    entryId: randomUUID(),
    category: Category.Anime,
    catalogId: null,
    snapshot: emptySnapshot(),
    fields: { userTitle: '  原文  ', sourceUrls: urls },
  });
}

test('ownership, no-op edits, optimistic concurrency and exact tombstone restore', async () => {
  const entry = await create();
  await expect(
    service.update(owners[1], entry.entryId, entry.serverVersion, { comment: 'private' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await service.update(owners[0], entry.entryId, entry.serverVersion, {})).toEqual(entry);
  const results = await Promise.allSettled([
    service.update(owners[0], entry.entryId, entry.serverVersion, { progress: 12 }),
    service.update(owners[0], entry.entryId, entry.serverVersion, { status: Status.Complete }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const row = await database.libraryEntry.findUniqueOrThrow({ where: { id: entry.entryId } });
  const current = row.document as unknown as typeof entry;
  const deleted = await service.setDeleted(owners[0], entry.entryId, current.serverVersion, true);
  const restored = await service.setDeleted(owners[0], entry.entryId, deleted.serverVersion, false);
  expect({
    ...restored,
    serverVersion: current.serverVersion,
    updatedAt: current.updatedAt,
  }).toEqual(current);
  expect(restored.createdAt).toBe(entry.createdAt);
});

test('concurrent normalized source duplicates have one winner and isolated owners', async () => {
  const url = `https://example.com/${randomUUID()}`;
  const results = await Promise.allSettled([create(owners[0], [url]), create(owners[0], [url])]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected')).toMatchObject({
    reason: { code: 'CONFLICT' },
  });
  await expect(create(owners[1], [url])).resolves.toMatchObject({
    sources: [{ normalizedUrl: url }],
  });
});

test('atomic reassignment and conflicting restore preserve source claims and revisions', async () => {
  const url = `https://example.com/${randomUUID()}`;
  const from = await create(owners[0], [url]);
  const to = await create();
  const before = await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } });
  await expect(
    service.reassignSource(owners[0], from.entryId, from.serverVersion, to.entryId, '0', url),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(
    (await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } })).revision,
  ).toBe(before.revision);
  const [first, second] = await service.reassignSource(
    owners[0],
    from.entryId,
    from.serverVersion,
    to.entryId,
    to.serverVersion,
    url,
  );
  expect(first.sources).toEqual([]);
  expect(second.sources).toEqual(from.sources);
  const deleted = await service.setDeleted(owners[0], second.entryId, second.serverVersion, true);
  await create(owners[0], [url]);
  const revision = (await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } }))
    .revision;
  await expect(
    service.setDeleted(owners[0], second.entryId, deleted.serverVersion, false),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(
    (await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } })).revision,
  ).toBe(revision);
  expect(
    (await database.libraryEntry.findUniqueOrThrow({ where: { id: second.entryId } })).deleted,
  ).toBe(true);
});

test('merge preserves survivor identity and publishes removed identity as a tombstone', async () => {
  const first = await create();
  const second = await create(owners[0], [`https://example.com/${randomUUID()}`]);
  const [survivor, removed] = await service.merge(
    owners[0],
    first.entryId,
    first.serverVersion,
    second.entryId,
    second.serverVersion,
    { comment: 'chosen fields' },
  );
  expect(survivor).toMatchObject({
    entryId: first.entryId,
    createdAt: first.createdAt,
    comment: 'chosen fields',
    sources: second.sources,
  });
  expect(removed).toMatchObject({ entryId: second.entryId, deleted: true });
  expect(BigInt(survivor.serverVersion)).toBe(BigInt(removed.serverVersion) + 1n);
});

test('owner lock prevents a later change from committing ahead of an earlier allocated revision', async () => {
  const owner = owners[0];
  let release!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const blocker = database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "ownerId" FROM "UserLibrary" WHERE "ownerId" = ${owner}::uuid FOR UPDATE`;
    locked();
    await gate;
  });
  await acquired;
  let finished = false;
  const pending = create(owner).then((entry) => {
    finished = true;

    return entry;
  });
  const observer = createDatabaseClient(environment.databaseUrl);
  try {
    // Observe a real PostgreSQL lock wait rather than relying on a scheduling delay.
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const rows = await observer.$queryRaw<
        Array<{ waiting: boolean }>
      >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%UserLibrary%FOR UPDATE%') AS waiting`;
      waiting = rows[0].waiting;
    }
    expect(waiting).toBe(true);
    expect(finished).toBe(false);
  } finally {
    release();
    await blocker;
    await observer.$disconnect();
  }
  const first = await pending;
  const second = await create(owner);
  expect(BigInt(second.serverVersion)).toBe(BigInt(first.serverVersion) + 1n);
  const changes = await database.entryChange.findMany({
    where: { ownerId: owner, revision: { gte: BigInt(first.serverVersion) } },
    orderBy: { revision: 'asc' },
  });
  expect(changes.map((change) => change.entryId)).toEqual([first.entryId, second.entryId]);
});

test('catalog duplicates race safely, deleted claims release and restore conflicts roll back', async () => {
  const catalogId = randomUUID();
  await database.catalogItem.create({
    data: { id: catalogId, category: Category.Anime, snapshot: {} },
  });
  try {
    const input = { category: Category.Anime, catalogId, snapshot: emptySnapshot(), fields: {} };
    const results = await Promise.allSettled([
      service.create(owners[0], { ...input, entryId: randomUUID() }),
      service.create(owners[0], { ...input, entryId: randomUUID() }),
    ]);
    const winner = results.find((result) => result.status === 'fulfilled');
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    if (!winner || winner.status !== 'fulfilled') throw new Error('Expected a winner');

    const deleted = await service.setDeleted(
      owners[0],
      winner.value.entryId,
      winner.value.serverVersion,
      true,
    );
    const replacement = await service.create(owners[0], { ...input, entryId: randomUUID() });
    await expect(
      service.setDeleted(owners[0], deleted.entryId, deleted.serverVersion, false),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await database.libraryEntry.deleteMany({ where: { catalogId } });
    expect(replacement.catalogId).toBe(catalogId);
  } finally {
    await database.catalogItem.delete({ where: { id: catalogId } });
  }
});

test('invalid merge preserves both documents and the change counter', async () => {
  const first = await create();
  const second = await create();
  const owner = await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } });
  await expect(
    service.merge(
      owners[0],
      first.entryId,
      first.serverVersion,
      second.entryId,
      second.serverVersion,
      { rating: 11 },
    ),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await database.userLibrary.findUniqueOrThrow({ where: { ownerId: owners[0] } })).toEqual(
    owner,
  );
  expect(
    (await database.libraryEntry.findUniqueOrThrow({ where: { id: second.entryId } })).deleted,
  ).toBe(false);
  expect(
    await database.entryChange.count({
      where: { ownerId: owners[0], revision: { gt: owner.revision } },
    }),
  ).toBe(0);
});

test('same UUID across owners cannot overwrite either owner and bigint cursors remain exact', async () => {
  const entryId = randomUUID();
  const input = {
    entryId,
    category: Category.Anime,
    catalogId: null,
    snapshot: emptySnapshot(),
    fields: { userTitle: 'Race fixture' },
  };
  const results = await Promise.allSettled(owners.map((owner) => service.create(owner, input)));
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  const row = await database.libraryEntry.findUniqueOrThrow({ where: { id: entryId } });
  expect(results[owners.indexOf(row.ownerId)].status).toBe('fulfilled');
  const id = randomUUID();
  await database.user.create({
    data: { id, googleSubject: id, library: { create: { revision: 9007199254740992n } } },
  });
  try {
    const entry = await create(id);
    expect(entry.serverVersion).toBe('9007199254740993');
    expect(
      (await database.entryChange.findFirstOrThrow({ where: { ownerId: id } })).revision.toString(),
    ).toBe(entry.serverVersion);
  } finally {
    await database.user.delete({ where: { id } });
  }
});

test('long valid source URLs fit database uniqueness keys', async () => {
  const url = `https://example.com/${Array.from({ length: 100 }, () => randomUUID()).join('')}`;
  const entry = await create(owners[0], [url]);
  expect(entry.sources[0].originalUrl).toBe(url);
  await expect(create(owners[0], [url])).rejects.toMatchObject({ code: 'CONFLICT' });
});

test('library edits proceed while the account row is locked', async () => {
  const entry = await create();
  let release!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const blocker = database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owners[0]}::uuid FOR UPDATE`;
    locked();
    await gate;
  });
  await acquired;
  try {
    const updated = await service.update(owners[0], entry.entryId, entry.serverVersion, {
      comment: 'independent library',
    });
    expect(updated.comment).toBe('independent library');
  } finally {
    release();
    await blocker;
  }
});

test('account deletion cascades through its library, entries, sources and history', async () => {
  const id = randomUUID();
  await database.user.create({ data: { id, googleSubject: id, library: { create: {} } } });
  const entry = await create(id, [`https://example.com/${randomUUID()}`]);
  await database.user.delete({ where: { id } });
  expect(await database.userLibrary.findUnique({ where: { ownerId: id } })).toBeNull();
  expect(await database.libraryEntry.findUnique({ where: { id: entry.entryId } })).toBeNull();
  expect(await database.sourceAssociation.count({ where: { ownerId: id } })).toBe(0);
  expect(await database.entryChange.count({ where: { ownerId: id } })).toBe(0);
});
