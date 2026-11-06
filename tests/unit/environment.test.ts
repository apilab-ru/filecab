import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { startupFailureMessage, validateEnvironment } from '../../apps/api/src/config/environment';

const development = {
  DATABASE_URL: 'postgresql://local:synthetic@127.0.0.1:5432/filecab_dev',
  WEBSITE_ORIGINS: 'http://127.0.0.1:5173',
};
const keyA = Buffer.alloc(32, 1).toString('base64');
const keyB = Buffer.alloc(32, 2).toString('base64');
const production = {
  ...development,
  NODE_ENV: 'production',
  DATABASE_URL: development.DATABASE_URL.replace('_dev', '_prod'),
  WEBSITE_ORIGINS: 'https://filecab.example',
  SESSION_SECRET: keyA,
  PROVIDER_ENCRYPTION_KEY: keyB,
};

describe('startup configuration', () => {
  it('starts without external credentials when integrations are disabled', () => {
    const config = validateEnvironment(development);
    expect(config.google.enabled).toBe(false);
    expect(config.providers.shikimori.enabled).toBe(false);
  });
  it.each(['0', '65536', 'NaN', '1.5', ''])('rejects invalid port %s', (port) => {
    expect(() => validateEnvironment({ ...development, PORT: port })).toThrow('PORT');
  });
  it('enforces isolated development, test, and production database names', () => {
    expect(() => validateEnvironment({ ...development, NODE_ENV: 'test' })).toThrow('DATABASE_URL');
    expect(() =>
      validateEnvironment({
        ...development,
        DATABASE_URL: development.DATABASE_URL.replace('_dev', '_prod'),
      }),
    ).toThrow('DATABASE_URL');
    expect(
      validateEnvironment({
        ...development,
        NODE_ENV: 'test',
        DATABASE_URL: development.DATABASE_URL.replace('_dev', '_test'),
      }).mode,
    ).toBe('test');
  });
  it('accepts production configuration with HTTPS and independent secrets', () => {
    expect(() => validateEnvironment(production)).not.toThrow();
  });
  it.each(['SESSION_SECRET', 'PROVIDER_ENCRYPTION_KEY'])(
    'rejects production without %s',
    (field) => {
      expect(() => validateEnvironment({ ...production, [field]: '' })).toThrow(field);
    },
  );
  it('rejects HTTP website origins even when all production secrets are valid', () => {
    expect(() =>
      validateEnvironment({ ...production, WEBSITE_ORIGINS: 'http://filecab.example' }),
    ).toThrow('WEBSITE_ORIGINS');
  });
  it('requires separate encryption and session keys', () => {
    expect(() =>
      validateEnvironment({ ...development, SESSION_SECRET: keyA, PROVIDER_ENCRYPTION_KEY: keyA }),
    ).toThrow('SESSION_SECRET');
  });
  it.each(['https://example.test/path', 'https://user:secret@example.test', '*', 'not-an-origin'])(
    'rejects unsafe website allowlist value %s',
    (origin) => {
      expect(() => validateEnvironment({ ...development, WEBSITE_ORIGINS: origin })).toThrow(
        'WEBSITE_ORIGINS',
      );
    },
  );
  it('validates exact Chrome extension origins', () => {
    expect(
      validateEnvironment({
        ...development,
        EXTENSION_ORIGINS: `chrome-extension://${'a'.repeat(32)}`,
      }).extensionOrigins,
    ).toHaveLength(1);
    expect(() =>
      validateEnvironment({ ...development, EXTENSION_ORIGINS: 'chrome-extension://*' }),
    ).toThrow('EXTENSION_ORIGINS');
  });
  it('requires enabled integration credentials and rejects insecure provider origins', () => {
    expect(() => validateEnvironment({ ...development, GOOGLE_ENABLED: 'true' })).toThrow(
      'GOOGLE_CLIENT_SECRET',
    );
    expect(() => validateEnvironment({ ...development, SHIKIMORI_ENABLED: 'true' })).toThrow(
      'SHIKIMORI_CLIENT_SECRET',
    );
    expect(() => validateEnvironment({ ...development, KINOPOISK_ENABLED: 'true' })).toThrow(
      'KINOPOISK_API_KEY',
    );
    expect(() =>
      validateEnvironment({ ...development, SMOTRET_API_ORIGIN: 'http://example.test' }),
    ).toThrow('SMOTRET_API_ORIGIN');
    expect(() => validateEnvironment({ ...development, GOOGLE_ENABLED: 'yes' })).toThrow(
      'GOOGLE_ENABLED',
    );
  });
  it('does not include database passwords or rejected values in errors', () => {
    let failure: unknown;
    try {
      validateEnvironment({ ...development, DATABASE_URL: 'sensitive-input-secret' });
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain('DATABASE_URL');
    expect((failure as Error).message).not.toContain('sensitive-input-secret');
  });
});

it('startup diagnostics explain invalid extension origins without printing submitted values', () => {
  let failure: unknown;
  try {
    validateEnvironment({
      ...development,
      EXTENSION_ORIGINS: 'https://sensitive-input-secret.example',
    });
  } catch (error) {
    failure = error;
  }
  const message = startupFailureMessage(failure);
  expect(message).toContain('Invalid configuration fields: EXTENSION_ORIGINS');
  expect(message).toContain('WEBSITE_ORIGINS');
  expect(message).toContain('chrome-extension://<extension-id>');
  expect(message).not.toContain('sensitive-input-secret');
});

it('startup diagnostics suppress arbitrary exception details, including configuration lookalikes', () => {
  for (const failure of [
    new Error('database password=sensitive-input-secret'),
    new Error('Invalid configuration fields: sensitive-input-secret'),
    { message: 'sensitive-input-secret' },
  ]) {
    expect(startupFailureMessage(failure)).toBe(
      'API startup failed; verify server configuration and availability',
    );
  }
});

it('validates authentication lifetimes and the exact Google callback route', () => {
  for (const fields of [
    { AUTH_ACCESS_SECONDS: '0' },
    { AUTH_SESSION_SECONDS: 'NaN' },
    { AUTH_ACCESS_SECONDS: '901' },
    { AUTH_SESSION_SECONDS: '60' },
    { AUTH_LOGIN_SECONDS: '10' },
  ])
    expect(() => validateEnvironment({ ...development, ...fields })).toThrow();
  const google = {
    ...development,
    GOOGLE_ENABLED: 'true',
    GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    SESSION_SECRET: keyA,
  };
  expect(() =>
    validateEnvironment({
      ...google,
      GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/auth-callback',
    }),
  ).toThrow('GOOGLE_CALLBACK_URL');
  expect(() =>
    validateEnvironment({
      ...google,
      GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3001/api/v1/auth/google/callback',
    }),
  ).not.toThrow();
});

it('the committed API environment example validates before adding any integration credentials', () => {
  const example = readFileSync(new URL('../../apps/api/.env.example', import.meta.url), 'utf8');
  expect(() => validateEnvironment(parseEnv(example))).not.toThrow();
});
