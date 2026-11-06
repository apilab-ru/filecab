import 'reflect-metadata';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import { validateEnvironment } from '../config/environment';
import { AppModule } from '../app.module';
import { configureApiApplication, createApiApplication } from './application';
import type { RequestDiagnostic } from './api-error';
import { StrictValidationPipe } from './validation';

const secret = 'private-note-oauth-code-token';
const origin = 'http://127.0.0.1:5173';
const extensionOrigin = `chrome-extension://${'a'.repeat(32)}`;
const environment = validateEnvironment({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://synthetic:password@127.0.0.1:1/filecab_test',
  WEBSITE_ORIGINS: origin,
  EXTENSION_ORIGINS: extensionOrigin,
});
const check = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
const diagnostics: RequestDiagnostic[] = [];

/** Test-only DTO proves that the real HTTP pipeline enforces runtime field bounds. */
class ExampleDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 10 })
  @IsInt()
  @Min(0)
  @Max(10)
  rating!: number;
}

/** Test-only routes exercise errors and unsafe requests without exposing production mutations. */
@Controller('fixture')
class FixtureController {
  @Post()
  update(@Body() body: ExampleDto): ExampleDto {
    return body;
  }

  @Get('failure')
  fail(): never {
    throw new Error(secret);
  }
}

// Vitest transpiles without emitted type metadata; match tsc's production parameter metadata.
Reflect.defineMetadata('design:paramtypes', [ExampleDto], FixtureController.prototype, 'update');

@Module({
  imports: [AppModule.configure(environment, { check })],
  controllers: [FixtureController],
})
class FixtureModule {}

let app: NestExpressApplication;
let production: NestExpressApplication;
let base: string;
let productionBase: string;

beforeAll(async () => {
  app = await NestFactory.create<NestExpressApplication>(FixtureModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
  });
  configureApiApplication(app, environment, (record) => diagnostics.push(record));
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  production = await createApiApplication(
    { ...environment, mode: 'production' },
    { readiness: { check }, diagnostic: (record) => diagnostics.push(record) },
  );
  await production.listen(0, '127.0.0.1');
  productionBase = await production.getUrl();
});

afterAll(async () => {
  await Promise.all([app?.close(), production?.close()]);
});

/** Sends a JSON request to the test-only mutation route. */
function post(body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/v1/fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('liveness needs no database and readiness hides database failures', async () => {
  check.mockRejectedValueOnce(new Error(secret));
  const live = await fetch(`${base}/api/v1/health/live`);
  expect(live.status).toBe(200);
  expect(await live.json()).toEqual({ schemaVersion: 1, status: 'ok' });
  expect(check).not.toHaveBeenCalled();
  const ready = await fetch(`${base}/api/v1/health/ready`);
  expect(ready.status).toBe(503);
  expect(await ready.json()).toMatchObject({
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    retryable: true,
    message: 'Service temporarily unavailable',
  });
  const recovered = await fetch(`${base}/api/v1/health/ready`);
  expect(recovered.status).toBe(200);
});

test('server correlation IDs replace submitted values and unknown routes return safe envelopes', async () => {
  const response = await fetch(`${base}/api/v1/missing?code=${secret}`, {
    headers: { 'X-Correlation-ID': secret },
  });
  const body = await response.json();
  expect(response.status).toBe(404);
  expect(body).toEqual({
    schemaVersion: 1,
    status: 404,
    code: 'NOT_FOUND',
    message: 'Resource not found',
    retryable: false,
    correlationId: response.headers.get('x-correlation-id'),
  });
  expect(body).toMatchObject({ correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  expect(JSON.stringify(body)).not.toContain(secret);
});

test('health query allowlists reject extra parameters', async () => {
  const response = await fetch(`${base}/api/v1/health/live?debug=true`);
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
});

test('DTOs reject out-of-bounds values, coercion, null and unknown fields', async () => {
  expect((await post({ rating: 0 })).status).toBe(201);
  for (const value of [
    { rating: 11 },
    { rating: '5' },
    { rating: null },
    [],
    {},
    { rating: 5, ownerId: secret },
  ]) {
    const response = await post(value);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'VALIDATION_ERROR', retryable: false });
    expect(JSON.stringify(body)).not.toContain(secret);
  }
  const reserved = await fetch(`${base}/api/v1/fixture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"rating":5,"__proto__":{}}',
  });
  expect(reserved.status).toBe(400);
});

test('deep JSON is rejected before DTO transformation', async () => {
  let nested: unknown = {};
  for (let depth = 0; depth < 40; depth++) nested = { nested };
  const response = await post({ rating: 5, nested });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    code: 'VALIDATION_ERROR',
    message: 'Request nesting exceeds the limit',
  });
});

test('body parsing errors, media type and body-size limits use the common envelope', async () => {
  for (const [body, contentType, status, code] of [
    ['{"comment":"' + secret, 'application/json', 400, 'VALIDATION_ERROR'],
    ['rating=5', 'application/x-www-form-urlencoded', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [
      JSON.stringify({ comment: 'x'.repeat(1024 * 1024) }),
      'application/json',
      413,
      'PAYLOAD_TOO_LARGE',
    ],
  ] as const) {
    const response = await fetch(`${base}/api/v1/fixture`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    });
    const result = await response.json();
    expect(response.status).toBe(status);
    expect(result).toMatchObject({
      status,
      code,
      correlationId: response.headers.get('x-correlation-id'),
    });
    expect(JSON.stringify(result)).not.toContain(secret);
  }
});

test('CORS allows exact website and extension origins with credentialed preflight', async () => {
  for (const allowed of [origin, extensionOrigin]) {
    const response = await fetch(`${base}/api/v1/health/live`, { headers: { Origin: allowed } });
    expect(response.headers.get('access-control-allow-origin')).toBe(allowed);
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-expose-headers')).toContain('X-Correlation-ID');
  }
  const preflight = await fetch(`${base}/api/v1/fixture`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-filecab-request',
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('access-control-allow-headers')).toContain('X-Filecab-Request');
  const denied = await fetch(`${base}/api/v1/health/live`, {
    headers: { Origin: `${origin}.evil.example` },
  });
  expect(denied.status).toBe(403);
  expect(denied.headers.has('access-control-allow-origin')).toBe(false);
});

test('cookie mutations require trusted Origin and CSRF header even with bearer credentials', async () => {
  const cookie = `__Host-filecab-session=${secret}`;
  const rejectedHeaders: Record<string, string>[] = [
    { Cookie: cookie },
    { Cookie: cookie, Origin: origin },
    { Cookie: cookie, Origin: 'https://attacker.example', 'X-Filecab-Request': '1' },
    { Cookie: cookie, Authorization: 'Bearer synthetic', Origin: origin },
  ];
  for (const headers of rejectedHeaders) {
    expect((await post({ rating: 5 }, headers)).status).toBe(403);
  }
  expect(
    (await post({ rating: 5 }, { Cookie: cookie, Origin: origin, 'X-Filecab-Request': '1' }))
      .status,
  ).toBe(201);
  expect((await post({ rating: 5 }, { Authorization: 'Bearer synthetic' })).status).toBe(201);
});

test('unexpected errors and diagnostics never expose URLs, credentials or private payloads', async () => {
  const response = await fetch(`${base}/api/v1/fixture/failure?shareToken=${secret}`, {
    headers: { Cookie: `session=${secret}`, Authorization: `Bearer ${secret}` },
  });
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({
    code: 'INTERNAL_ERROR',
    retryable: true,
    message: 'Internal server error',
  });
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(JSON.stringify(diagnostics)).not.toContain(secret);
  for (const record of diagnostics)
    expect(Object.keys(record).sort()).toEqual(['correlationId', 'elapsedMs', 'method', 'status']);
});

test('OpenAPI documents actual anonymous health routes and common errors', async () => {
  const ui = await fetch(`${base}/api/docs`);
  expect(ui.status).toBe(200);
  expect(await ui.text()).toContain('Swagger UI');
  const response = await fetch(`${base}/api/docs-json`);
  const document = await response.json();
  expect(document).toMatchObject({
    paths: {
      '/api/v1/health/live': { get: { security: [] } },
      '/api/v1/health/ready': {
        get: {
          responses: {
            '503': {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/ApiErrorDto' } },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ApiErrorDto: { required: expect.arrayContaining(['status', 'retryable', 'correlationId']) },
      },
      securitySchemes: { bearer: { scheme: 'bearer' } },
    },
    info: { description: expect.stringContaining('X-Filecab-Request: 1') },
  });
  expect(JSON.stringify(document)).not.toContain(secret);
  expect((await fetch(`${base}/api/docs-yaml`)).status).toBe(404);
});

test('production disables all documentation and requires HTTPS from its loopback proxy', async () => {
  expect((await fetch(`${productionBase}/api/v1/health/live`)).status).toBe(403);
  const secure = { 'X-Forwarded-Proto': 'https' };
  const live = await fetch(`${productionBase}/api/v1/health/live`, { headers: secure });
  expect(live.status).toBe(200);
  expect(live.headers.get('strict-transport-security')).toContain('max-age=31536000');
  for (const path of [
    '/api/docs',
    '/api/docs-json',
    '/api/docs-yaml',
    '/api/docs/swagger-ui-init.js',
  ]) {
    expect((await fetch(`${productionBase}${path}`, { headers: secure })).status).toBe(404);
  }
});

test('primitive query parameters are not implicitly coerced by Nest validation', async () => {
  const pipe = new StrictValidationPipe();
  expect(await pipe.transform('5', { type: 'query', metatype: Number, data: 'rating' })).toBe('5');
  expect(await pipe.transform('false', { type: 'query', metatype: Boolean, data: 'enabled' })).toBe(
    'false',
  );
});

test('disabled Google login fails explicitly before opening a database connection', async () => {
  const response = await fetch(
    `${base}/api/v1/auth/google/start?${new URLSearchParams({ client: 'website', returnTo: `${origin}/` })}`,
    { redirect: 'manual' },
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Google login is disabled',
    retryable: false,
  });
});

test('anonymous extension configuration is bounded, public and independent of database availability', async () => {
  const response = await fetch(
    `${base}/api/v1/auth/extension/config?extensionId=${'a'.repeat(32)}`,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    schemaVersion: 1,
    googleEnabled: false,
    extensionAllowed: true,
  });
  const denied = await fetch(`${base}/api/v1/auth/extension/config?extensionId=${'b'.repeat(32)}`);
  expect(await denied.json()).toEqual({
    schemaVersion: 1,
    googleEnabled: false,
    extensionAllowed: false,
  });
  const malformed = await fetch(`${base}/api/v1/auth/extension/config?extensionId=not-a-chrome-id`);
  expect(malformed.status).toBe(400);
});
