import { afterAll, beforeAll, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { validateEnvironment } from '../config/environment';
import { createApiApplication } from '../http/application';

const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
});

let app: NestExpressApplication;
let base: string;

beforeAll(async () => {
  app = await createApiApplication(environment, { diagnostic: () => {} });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
});

test('HTTP readiness succeeds through the production PostgreSQL probe', async () => {
  const response = await fetch(`${base}/api/v1/health/ready`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ schemaVersion: 1, status: 'ok' });
});
