import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { validateEnvironment } from '../config/environment';
import { createApiApplication } from '../http/application';
import { AuthService, type SessionTokens } from './auth.service';
import { AuthClient, credentialHash, randomCredential, verifierChallenge } from './credentials';
import type { GoogleIdentityProvider } from './google';

const secret = Buffer.alloc(32, 11).toString('base64');
const prefix = `google-fixture-${randomUUID()}`;
const website = 'http://127.0.0.1:5173';
const extension = `chrome-extension://${'a'.repeat(32)}`;
const environment = validateEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  WEBSITE_ORIGINS: website,
  EXTENSION_ORIGINS: extension,
  SESSION_SECRET: secret,
  PROVIDER_ENCRYPTION_KEY: Buffer.alloc(32, 12).toString('base64'),
  GOOGLE_ENABLED: 'true',
  GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'synthetic-client-secret',
  GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/v1/auth/google/callback',
});
const provider: GoogleIdentityProvider = {
  authorizationUrl: (state, nonce) =>
    `https://accounts.google.com/?${new URLSearchParams({ state, nonce })}`,
  exchange: async (code) => `${prefix}-${code}`,
};

let app: NestExpressApplication;
let base: string;
let auth: AuthService;

beforeAll(async () => {
  app = await createApiApplication(environment, { google: provider, diagnostic: () => {} });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  auth = app.get(AuthService);
});

afterAll(async () => {
  if (auth) {
    await auth.database.user.deleteMany({ where: { googleSubject: { startsWith: prefix } } });
    await auth.database.loginAttempt.deleteMany({ where: { stateHash: { in: stateHashes } } });
  }

  await app?.close();
});

const stateHashes: string[] = [];

/** Starts a service login while retaining only this test's attempt hashes for cleanup. */
async function start(client = AuthClient.Extension, subject = 'same-owner') {
  const verifier = randomCredential();
  const attempt = randomCredential();
  const returnTo =
    client === AuthClient.Website
      ? `${website}/`
      : `https://${'a'.repeat(32)}.chromiumapp.org/filecab`;
  const result = await auth.start(
    client,
    returnTo,
    client === AuthClient.Extension ? verifierChallenge(verifier) : undefined,
    client === AuthClient.Extension ? attempt : undefined,
  );
  const state = new URL(result.url).searchParams.get('state')!;
  stateHashes.push(credentialHash(state, secret));

  return { ...result, state, verifier, attempt, subject };
}

/** Completes a fresh extension flow using only the returned one-use exchange code. */
async function login(subject = 'same-owner'): Promise<SessionTokens> {
  const attempt = await start(AuthClient.Extension, subject);
  const callback = await auth.callback(attempt.state, attempt.binding, subject);
  const code = new URL(callback.returnTo).searchParams.get('code')!;

  return auth.exchange(code, attempt.attempt, attempt.verifier);
}

/** Sends a bounded JSON request through the real HTTP pipeline. */
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api/v1/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

test('state and browser binding are required; login attempts are one-use and expire', async () => {
  const attempt = await start();
  await expect(
    auth.callback(randomCredential(), attempt.binding, 'same-owner'),
  ).rejects.toMatchObject({ httpStatus: 401 });
  await expect(
    auth.callback(attempt.state, randomCredential(), 'same-owner'),
  ).rejects.toMatchObject({ httpStatus: 401 });
  await auth.callback(attempt.state, attempt.binding, 'same-owner');
  await expect(auth.callback(attempt.state, attempt.binding, 'same-owner')).rejects.toMatchObject({
    httpStatus: 401,
  });
  const expired = await start();
  await auth.database.loginAttempt.update({
    where: { stateHash: credentialHash(expired.state, secret) },
    data: { expiresAt: new Date(0) },
  });
  await expect(auth.callback(expired.state, expired.binding, 'same-owner')).rejects.toMatchObject({
    httpStatus: 401,
  });
});

test('untrusted destinations and website/extension binding confusion are rejected', async () => {
  await expect(auth.start(AuthClient.Website, 'https://attacker.example/')).rejects.toMatchObject({
    httpStatus: 400,
  });
  await expect(
    auth.start(
      AuthClient.Extension,
      'https://attacker.chromiumapp.org/filecab',
      randomCredential(),
      randomCredential(),
    ),
  ).rejects.toMatchObject({ httpStatus: 400 });
  await expect(
    auth.start(AuthClient.Website, `${website}/`, randomCredential(), randomCredential()),
  ).rejects.toMatchObject({ httpStatus: 400 });
});

test('extension code requires its initiating verifier and attempt, expires and is consumed once', async () => {
  const attempt = await start();
  const callback = await auth.callback(attempt.state, attempt.binding, 'same-owner');
  const url = new URL(callback.returnTo);
  const code = url.searchParams.get('code')!;
  expect([...url.searchParams.keys()].sort()).toEqual(['attempt', 'code']);
  await expect(auth.exchange(code, randomCredential(), attempt.verifier)).rejects.toMatchObject({
    httpStatus: 401,
  });
  await expect(auth.exchange(code, attempt.attempt, randomCredential())).rejects.toMatchObject({
    httpStatus: 401,
  });
  const tokens = await auth.exchange(code, attempt.attempt, attempt.verifier);
  await expect(auth.exchange(code, attempt.attempt, attempt.verifier)).rejects.toMatchObject({
    httpStatus: 401,
  });
  expect(await auth.authenticate(tokens.accessToken, AuthClient.Extension)).toMatchObject({
    ownerId: tokens.ownerId,
  });
  const expired = await start();
  const returned = await auth.callback(expired.state, expired.binding, 'same-owner');
  const expiredCode = new URL(returned.returnTo).searchParams.get('code')!;
  await auth.database.loginExchange.update({
    where: { codeHash: credentialHash(expiredCode, secret) },
    data: { expiresAt: new Date(0) },
  });
  await expect(auth.exchange(expiredCode, expired.attempt, expired.verifier)).rejects.toMatchObject(
    { httpStatus: 401 },
  );
});

test('same verified subject creates one account/library even across concurrent logins', async () => {
  const tokens = await Promise.all([login('concurrent-owner'), login('concurrent-owner')]);
  expect(tokens[0].ownerId).toBe(tokens[1].ownerId);
  expect(await auth.database.userLibrary.count({ where: { ownerId: tokens[0].ownerId } })).toBe(1);
  const different = await login('different-owner');
  expect(different.ownerId).not.toBe(tokens[0].ownerId);
});

test('rotation persists only hashes; consumed refresh replay revokes the new access token', async () => {
  const first = await login();
  const rotated = await auth.refresh(first.refreshToken, AuthClient.Extension);
  expect(rotated.sessionExpiresAt).toBe(first.sessionExpiresAt);
  expect(rotated.refreshToken).not.toBe(first.refreshToken);
  const session = await auth.database.session.findUniqueOrThrow({
    where: { accessHash: credentialHash(rotated.accessToken, secret) },
  });
  expect(JSON.stringify(session)).not.toContain(rotated.accessToken);
  expect(JSON.stringify(session)).not.toContain(rotated.refreshToken);
  await expect(auth.authenticate(first.accessToken, AuthClient.Extension)).rejects.toMatchObject({
    httpStatus: 401,
  });
  await expect(auth.refresh(first.refreshToken, AuthClient.Extension)).rejects.toMatchObject({
    httpStatus: 401,
  });
  await expect(auth.authenticate(rotated.accessToken, AuthClient.Extension)).rejects.toMatchObject({
    httpStatus: 401,
  });
});

test('concurrent duplicate refresh has one successor and revokes that entire family', async () => {
  const tokens = await login();
  const results = await Promise.allSettled([
    auth.refresh(tokens.refreshToken, AuthClient.Extension),
    auth.refresh(tokens.refreshToken, AuthClient.Extension),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const winner = results.find((result) => result.status === 'fulfilled');

  if (winner?.status !== 'fulfilled') throw new Error('Expected one successor');

  await expect(
    auth.authenticate(winner.value.accessToken, AuthClient.Extension),
  ).rejects.toMatchObject({ httpStatus: 401 });
});

test('access, idle and absolute expiry are enforced independently', async () => {
  for (const field of ['accessExpiresAt', 'idleExpiresAt', 'expiresAt']) {
    const tokens = await login();
    await auth.database.session.update({
      where: { accessHash: credentialHash(tokens.accessToken, secret) },
      data: { [field]: new Date(0) },
    });
    await expect(auth.authenticate(tokens.accessToken, AuthClient.Extension)).rejects.toMatchObject(
      { httpStatus: 401 },
    );

    if (field !== 'accessExpiresAt')
      await expect(auth.refresh(tokens.refreshToken, AuthClient.Extension)).rejects.toMatchObject({
        httpStatus: 401,
      });
    else
      await expect(auth.refresh(tokens.refreshToken, AuthClient.Extension)).resolves.toHaveProperty(
        'accessToken',
      );
  }
});

test('owner identity ignores submitted owners; logout and all-session revocation isolate accounts', async () => {
  const first = await login('logout-owner');
  const second = await login('logout-owner');
  const other = await login('untouched-owner');
  const me = await fetch(`${base}/api/v1/auth/me?ownerId=${other.ownerId}`, {
    headers: { Authorization: `Bearer ${first.accessToken}` },
  });
  expect(me.status).toBe(400);
  const self = await fetch(`${base}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${first.accessToken}` },
  });
  expect(await self.json()).toEqual({ schemaVersion: 1, ownerId: first.ownerId });
  const signedOut = await fetch(`${base}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${first.accessToken}` },
  });
  expect(signedOut.status).toBe(204);
  await expect(auth.authenticate(first.accessToken, AuthClient.Extension)).rejects.toMatchObject({
    httpStatus: 401,
  });
  await expect(auth.authenticate(second.accessToken, AuthClient.Extension)).resolves.toHaveProperty(
    'ownerId',
    first.ownerId,
  );
  const allSignedOut = await fetch(`${base}/api/v1/auth/logout-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${second.accessToken}` },
  });
  expect(allSignedOut.status).toBe(204);
  await expect(auth.refresh(second.refreshToken, AuthClient.Extension)).rejects.toMatchObject({
    httpStatus: 401,
  });
  await expect(auth.authenticate(other.accessToken, AuthClient.Extension)).resolves.toHaveProperty(
    'ownerId',
    other.ownerId,
  );
});

test('website HTTP flow uses HttpOnly cookies, no token redirect and cookie-only refresh', async () => {
  const started = await fetch(
    `${base}/api/v1/auth/google/start?${new URLSearchParams({ client: 'website', returnTo: `${website}/` })}`,
    { redirect: 'manual' },
  );
  expect(started.status).toBe(302);
  const bindingCookie = started.headers.getSetCookie()[0].split(';')[0];
  expect(started.headers.getSetCookie()[0]).toContain('HttpOnly');
  const state = new URL(started.headers.get('location')!).searchParams.get('state')!;
  stateHashes.push(credentialHash(state, secret));
  const callback = await fetch(
    `${base}/api/v1/auth/google/callback?${new URLSearchParams({ state, code: 'website-owner', scope: 'openid', ignoredByDesign: 'synthetic' })}`,
    { redirect: 'manual', headers: { Cookie: bindingCookie } },
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.get('location')).toBe(`${website}/`);
  const cookies = callback.headers
    .getSetCookie()
    .filter((cookie) => !cookie.startsWith('filecab-login='));
  expect(cookies).toHaveLength(2);
  for (const cookie of cookies) {
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  }
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const me = await fetch(`${base}/api/v1/auth/me`, { headers: { Cookie: cookie } });
  expect(me.status).toBe(200);
  const blocked = await post('refresh', {}, { Cookie: cookie, Origin: website });
  expect(blocked.status).toBe(403);
  const refreshed = await post(
    'refresh',
    {},
    { Cookie: cookie, Origin: website, 'X-Filecab-Request': '1' },
  );
  expect(refreshed.status).toBe(200);
  const body = await refreshed.json();
  expect(body).toMatchObject({ schemaVersion: 1 });
  expect(Object.keys(body as object).sort()).toEqual(['ownerId', 'schemaVersion']);
  const access = cookies
    .find((item) => item.startsWith('filecab-access='))!
    .split(';')[0]
    .split('=')[1];
  expect(
    (await fetch(`${base}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${access}` } }))
      .status,
  ).toBe(401);
});

test('bearer access cannot be substituted with refresh credentials or website cookies', async () => {
  const tokens = await login();
  expect(
    (
      await fetch(`${base}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.refreshToken}` },
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await fetch(`${base}/api/v1/auth/me`, {
        headers: { Cookie: `filecab-access=${tokens.accessToken}` },
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await fetch(`${base}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          Cookie: `filecab-session=${tokens.refreshToken}`,
        },
      })
    ).status,
  ).toBe(401);
  const invalid = await post('exchange', {
    code: randomCredential(),
    attempt: randomCredential(),
    verifier: randomCredential(),
    ownerId: tokens.ownerId,
  });
  expect(invalid.status).toBe(400);
});

test('production callback issues Secure host-only HttpOnly cookies', async () => {
  const production = await createApiApplication(
    { ...environment, mode: 'production', websiteOrigins: ['https://filecab.example'] },
    { google: provider, diagnostic: () => {} },
  );
  try {
    await production.listen(0, '127.0.0.1');
    const service = production.get(AuthService);
    const attempt = await service.start(AuthClient.Website, 'https://filecab.example/');
    const state = new URL(attempt.url).searchParams.get('state')!;
    stateHashes.push(credentialHash(state, secret));
    const response = await fetch(
      `${await production.getUrl()}/api/v1/auth/google/callback?${new URLSearchParams({ state, code: 'production-owner' })}`,
      {
        redirect: 'manual',
        headers: {
          'X-Forwarded-Proto': 'https',
          Cookie: `__Host-filecab-login=${attempt.binding}`,
        },
      },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://filecab.example/');
    const cookies = response.headers
      .getSetCookie()
      .filter((cookie) => !cookie.startsWith('__Host-filecab-login='));
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Domain=');
    }
  } finally {
    await production.close();
  }
});

test('OpenAPI describes the exchange bounds, refresh variants and actual cookie/bearer account access', async () => {
  const response = await fetch(`${base}/api/docs-json`);
  const document = await response.json();
  expect(document).toMatchObject({
    paths: {
      '/api/v1/auth/exchange': {
        post: {
          requestBody: {
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ExchangeDto' } },
            },
          },
        },
      },
      '/api/v1/auth/me': { get: { security: [{ bearer: [] }, { cookie: [] }] } },
      '/api/v1/auth/refresh': {
        post: {
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { $ref: '#/components/schemas/AccountDto' },
                      { $ref: '#/components/schemas/ExtensionTokensDto' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ExchangeDto: { properties: { verifier: { pattern: '^[A-Za-z0-9._~-]{43,128}$' } } },
      },
      securitySchemes: { cookie: { name: 'filecab-access', in: 'cookie' } },
    },
  });
  expect(JSON.stringify(document)).not.toContain(environment.google.clientSecret);
});
