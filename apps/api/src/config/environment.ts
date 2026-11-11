import { config } from 'dotenv';
import { resolve } from 'node:path';

type Environment = Readonly<Record<string, string | undefined>>;

/** Identifies invalid configuration fields without retaining their submitted values. */
export class EnvironmentValidationError extends Error {
  constructor(readonly fields: string[]) {
    super(`Invalid configuration fields: ${fields.join(', ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

/** Validates server configuration without exposing secret values in failures. */
export function validateEnvironment(env: Environment) {
  const invalid = new Set<string>();
  const required = (key: string) => {
    const value = env[key]?.trim() ?? '';

    if (!value) invalid.add(key);

    return value;
  };
  const flag = (key: string) => {
    const value = env[key] ?? 'false';

    if (value !== 'true' && value !== 'false') invalid.add(key);

    return value === 'true';
  };
  const mode = env.NODE_ENV ?? 'development';

  if (!['development', 'test', 'production'].includes(mode)) invalid.add('NODE_ENV');

  const portText = env.PORT ?? '3001';
  const port = Number(portText);

  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535)
    invalid.add('PORT');

  const databaseUrl = required('DATABASE_URL');
  try {
    const parsed = new URL(databaseUrl);
    const name = decodeURIComponent(parsed.pathname.slice(1));

    if (
      !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.username ||
      !name ||
      name.includes('/')
    )
      invalid.add('DATABASE_URL');

    if (mode === 'test' && !name.endsWith('_test')) invalid.add('DATABASE_URL');

    if (mode === 'production' && /_(dev|test)$/.test(name)) invalid.add('DATABASE_URL');

    if (mode === 'development' && !name.endsWith('_dev')) invalid.add('DATABASE_URL');
  } catch {
    invalid.add('DATABASE_URL');
  }

  const httpUrl = (key: string, value: string, originOnly = false) => {
    try {
      const parsed = new URL(value);

      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      )
        invalid.add(key);

      if (mode === 'production' && parsed.protocol !== 'https:') invalid.add(key);

      if (originOnly && (parsed.pathname !== '/' || parsed.search)) invalid.add(key);

      return originOnly ? parsed.origin : parsed.href;
    } catch {
      invalid.add(key);

      return '';
    }
  };
  const websiteOrigins = required('WEBSITE_ORIGINS')
    .split(',')
    .map((value) => httpUrl('WEBSITE_ORIGINS', value.trim(), true));
  const extensionOrigins = (env.EXTENSION_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of extensionOrigins) {
    if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) invalid.add('EXTENSION_ORIGINS');
  }
  const catalogOperatorAccountIds = (env.CATALOG_OPERATOR_ACCOUNT_IDS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    catalogOperatorAccountIds.some(
      (id) =>
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
    )
  )
    invalid.add('CATALOG_OPERATOR_ACCOUNT_IDS');

  const secret = (key: string, needed: boolean) => {
    const value = env[key] ?? '';

    if (
      (needed || value) &&
      (!/^[A-Za-z0-9+/]{43}=$/.test(value) || Buffer.from(value, 'base64').length !== 32)
    )
      invalid.add(key);

    return value;
  };
  const googleEnabled = flag('GOOGLE_ENABLED');
  const shikimoriEnabled = flag('SHIKIMORI_ENABLED');
  const smotretEnabled = flag('SMOTRET_ENABLED');
  const kinopoiskEnabled = flag('KINOPOISK_ENABLED');
  const sessionSecret = secret('SESSION_SECRET', mode === 'production' || googleEnabled);
  const encryptionKey = secret(
    'PROVIDER_ENCRYPTION_KEY',
    mode === 'production' || shikimoriEnabled,
  );

  if (sessionSecret && encryptionKey && sessionSecret === encryptionKey) {
    invalid.add('SESSION_SECRET');
    invalid.add('PROVIDER_ENCRYPTION_KEY');
  }

  const integrationUrl = (key: string, fallback: string) => {
    const value = env[key] ?? fallback;
    const normalized = httpUrl(key, value, true);

    if (!value.startsWith('https://')) invalid.add(key);

    return normalized;
  };
  const duration = (key: string, fallback: number, maximum: number) => {
    const text = env[key] ?? String(fallback);
    const value = Number(text);

    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < 1 || value > maximum)
      invalid.add(key);

    return value;
  };
  const boundedInteger = (key: string, fallback: number, minimum: number, maximum: number) => {
    const text = env[key] ?? String(fallback);
    const value = Number(text);

    if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < minimum || value > maximum)
      invalid.add(key);

    return value;
  };
  const catalog = {
    operatorAccountIds: catalogOperatorAccountIds,
    budgets: {
      timeoutMs: duration('CATALOG_PROVIDER_TIMEOUT_MS', 5000, 30000),
      maxResponseBytes: duration('CATALOG_PROVIDER_MAX_RESPONSE_BYTES', 262144, 1048576),
      maxGenres: duration('CATALOG_PROVIDER_MAX_GENRES', 500, 2000),
      concurrency: duration('CATALOG_PROVIDER_CONCURRENCY', 2, 8),
      retries: boundedInteger('CATALOG_PROVIDER_RETRIES', 2, 0, 5),
      maxRetryAfterSeconds: duration('CATALOG_PROVIDER_MAX_RETRY_AFTER_SECONDS', 60, 300),
    },
  };
  const auth = {
    accessSeconds: duration('AUTH_ACCESS_SECONDS', 900, 900),
    sessionSeconds: duration('AUTH_SESSION_SECONDS', 2592000, 2592000),
    idleSeconds: duration('AUTH_IDLE_SECONDS', 604800, 604800),
    loginSeconds: duration('AUTH_LOGIN_SECONDS', 600, 600),
    exchangeSeconds: duration('AUTH_EXCHANGE_SECONDS', 60, 60),
  };

  if (auth.accessSeconds > auth.idleSeconds || auth.idleSeconds > auth.sessionSeconds)
    invalid.add('AUTH_IDLE_SECONDS');

  if (auth.exchangeSeconds > auth.loginSeconds) invalid.add('AUTH_EXCHANGE_SECONDS');

  const google = {
    enabled: googleEnabled,
    clientId: googleEnabled ? required('GOOGLE_CLIENT_ID') : undefined,
    clientSecret: googleEnabled ? required('GOOGLE_CLIENT_SECRET') : undefined,
    callbackUrl: googleEnabled
      ? httpUrl('GOOGLE_CALLBACK_URL', required('GOOGLE_CALLBACK_URL'))
      : undefined,
  };

  if (google.callbackUrl) {
    const callback = new URL(google.callbackUrl);

    if (callback.pathname !== '/api/v1/auth/google/callback' || callback.search || callback.hash)
      invalid.add('GOOGLE_CALLBACK_URL');
  }

  const shikimori = {
    enabled: shikimoriEnabled,
    origin: integrationUrl('SHIKIMORI_API_ORIGIN', 'https://shikimori.io'),
    clientId: shikimoriEnabled ? required('SHIKIMORI_CLIENT_ID') : undefined,
    clientSecret: shikimoriEnabled ? required('SHIKIMORI_CLIENT_SECRET') : undefined,
    callbackUrl: shikimoriEnabled
      ? httpUrl('SHIKIMORI_CALLBACK_URL', required('SHIKIMORI_CALLBACK_URL'))
      : undefined,
    userAgent: shikimoriEnabled ? required('SHIKIMORI_USER_AGENT') : undefined,
  };
  const providers = {
    smotret: {
      enabled: smotretEnabled,
      origin: integrationUrl('SMOTRET_API_ORIGIN', 'https://smotret-anime.online'),
    },
    kinopoisk: {
      enabled: kinopoiskEnabled,
      origin: integrationUrl('KINOPOISK_API_ORIGIN', 'https://api.kinopoisk.dev'),
      apiKey: kinopoiskEnabled ? required('KINOPOISK_API_KEY') : undefined,
    },
    shikimori,
  };

  if (invalid.size) throw new EnvironmentValidationError([...invalid].sort());

  return {
    mode,
    port,
    databaseUrl,
    websiteOrigins,
    extensionOrigins,
    sessionSecret,
    encryptionKey,
    google,
    auth,
    catalog,
    providers,
  };
}

/** Formats trusted configuration failures while suppressing arbitrary startup exception details. */
export function startupFailureMessage(error: unknown): string {
  if (!(error instanceof EnvironmentValidationError))
    return 'API startup failed; verify server configuration and availability';

  const guidance = error.fields.includes('EXTENSION_ORIGINS')
    ? ' EXTENSION_ORIGINS must be empty or contain chrome-extension://<extension-id>; put website URLs in WEBSITE_ORIGINS.'
    : '';

  return `API startup failed: ${error.message}. Check apps/api/.env.${guidance}`;
}

/** Loads the local environment file before validating effective process configuration. */
export function loadEnvironment() {
  config({ path: resolve(__dirname, '../../.env'), quiet: true });

  return validateEnvironment(process.env);
}

export type ApiEnvironment = ReturnType<typeof validateEnvironment>;
