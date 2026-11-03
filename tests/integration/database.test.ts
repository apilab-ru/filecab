import { afterAll, beforeAll, expect, test } from 'vitest';
import { createDatabaseClient } from '../../apps/api/src/database/client';
import { validateEnvironment } from '../../apps/api/src/config/environment';

// No .env auto-load: the runner must explicitly select a disposable test database.
const environment = validateEnvironment({ ...process.env, NODE_ENV: 'test', WEBSITE_ORIGINS: 'http://127.0.0.1:5173' });
const database = createDatabaseClient(environment.databaseUrl);
beforeAll(async () => { await database.$connect(); });
afterAll(async () => { await database.$disconnect(); });

test('committed migration and generated Prisma client work on PostgreSQL 17', async () => {
  const [version] = await database.$queryRaw<Array<{ server_version_num: string }>>`SHOW server_version_num`;
  expect(Number(version.server_version_num)).toBeGreaterThanOrEqual(170000);
  expect(Number(version.server_version_num)).toBeLessThan(180000);
  expect(await database.workspaceState.findUnique({ where: { id: 'baseline' } })).toMatchObject({ id: 'baseline' });
});
