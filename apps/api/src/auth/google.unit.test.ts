import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
  type JWTPayload,
} from 'jose';
import { GoogleOAuthProvider, verifyGoogleIdentity } from './google';
import { validateEnvironment } from '../config/environment';
import { verifierChallenge } from './credentials';

const environment = validateEnvironment({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://fixture:synthetic@127.0.0.1:1/filecab_test',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
  GOOGLE_ENABLED: 'true',
  GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'synthetic-secret',
  GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/v1/auth/google/callback',
  SESSION_SECRET: Buffer.alloc(32, 1).toString('base64'),
});

let publicJwk: Awaited<ReturnType<typeof exportJWK>>;

let keys: JWTVerifyGetKey;
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' };
  keys = createLocalJWKSet({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'fixture', alg: 'RS256' }],
  });
});

/** Signs independent issuer claims so security failures exercise real JWT verification. */
async function token(overrides: JWTPayload = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: 'google-subject',
    iss: 'https://accounts.google.com',
    aud: 'fixture-client',
    iat: now,
    exp: now + 300,
    nonce: 'fixture-nonce',
    ...overrides,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(privateKey);
}

test('verified subject is returned for both Google issuer forms', async () => {
  for (const iss of ['https://accounts.google.com', 'accounts.google.com']) {
    expect(
      await verifyGoogleIdentity(
        await token({ iss, email: 'not-an-identity@example.test' }),
        'fixture-client',
        'fixture-nonce',
        keys,
      ),
    ).toBe('google-subject');
  }
});

test.each([
  { iss: 'https://attacker.example' },
  { aud: 'another-client' },
  { exp: 1 },
  { iat: Math.floor(Date.now() / 1000) + 3600 },
  { nonce: 'another-attempt' },
  { azp: 'another-client' },
  { sub: '' },
  { aud: ['fixture-client', 'another-client'] },
])('rejects invalid signed claims %j', async (claims) => {
  await expect(
    verifyGoogleIdentity(await token(claims), 'fixture-client', 'fixture-nonce', keys),
  ).rejects.toMatchObject({ httpStatus: 401 });
});

test('rejects missing required claims and signatures from an untrusted key', async () => {
  const missingNonce = await new SignJWT({
    sub: 'google-subject',
    iss: 'https://accounts.google.com',
    aud: 'fixture-client',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'fixture' })
    .sign(privateKey);
  await expect(
    verifyGoogleIdentity(missingNonce, 'fixture-client', 'fixture-nonce', keys),
  ).rejects.toMatchObject({ httpStatus: 401 });
  const other = await generateKeyPair('RS256');
  const untrusted = createLocalJWKSet({
    keys: [{ ...(await exportJWK(other.publicKey)), kid: 'fixture', alg: 'RS256' }],
  });
  await expect(
    verifyGoogleIdentity(await token(), 'fixture-client', 'fixture-nonce', untrusted),
  ).rejects.toMatchObject({ httpStatus: 401 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('code exchange verifies a signed ID token using bounded Google key retrieval', async () => {
  const signed = await token({ aud: environment.google.clientId });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/certs'))
        return new Response(JSON.stringify({ keys: [publicJwk] }));

      const body = init?.body as URLSearchParams;
      expect(body.get('code_verifier')).toBe('fixture-verifier');
      expect(body.get('redirect_uri')).toBe(environment.google.callbackUrl);

      return new Response(JSON.stringify({ id_token: signed }));
    }),
  );
  const provider = new GoogleOAuthProvider(environment);
  const authorization = new URL(
    provider.authorizationUrl('fixture-state', 'fixture-nonce', 'fixture-verifier'),
  );
  expect(authorization.searchParams.get('code_challenge')).toBe(
    verifierChallenge('fixture-verifier'),
  );
  expect(authorization.searchParams.has('client_secret')).toBe(false);
  expect(await provider.exchange('fixture-code', 'fixture-nonce', 'fixture-verifier')).toBe(
    'google-subject',
  );
});

test.each(['network', 'oversized-token', 'oversized-keys', 'upstream-error'])(
  'Google %s failures remain retryable and do not expose response contents',
  async (failure) => {
    const signed = await token({ aud: environment.google.clientId });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        if (failure === 'network') throw new Error('private-upstream-secret');

        if (failure === 'upstream-error')
          return new Response('private-upstream-secret', { status: 500 });

        if (failure === 'oversized-token' || String(url).includes('/certs'))
          return new Response('x'.repeat(65537));

        return new Response(JSON.stringify({ id_token: signed }));
      }),
    );
    await expect(
      new GoogleOAuthProvider(environment).exchange(
        'fixture-code',
        'fixture-nonce',
        'fixture-verifier',
      ),
    ).rejects.toMatchObject({
      httpStatus: 503,
      retryable: true,
      safeMessage: 'Google login is temporarily unavailable',
    });
  },
);
