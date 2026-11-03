import { config } from 'dotenv';
import { resolve } from 'node:path';

type Environment = Readonly<Record<string, string | undefined>>;

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
  const google = {
    enabled: googleEnabled,
    clientId: googleEnabled ? required('GOOGLE_CLIENT_ID') : undefined,
    clientSecret: googleEnabled ? required('GOOGLE_CLIENT_SECRET') : undefined,
    callbackUrl: googleEnabled
      ? httpUrl('GOOGLE_CALLBACK_URL', required('GOOGLE_CALLBACK_URL'))
      : undefined,
  };
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
  if (invalid.size)
    throw new Error(`Invalid configuration fields: ${[...invalid].sort().join(', ')}`);
  return {
    mode,
    port,
    databaseUrl,
    websiteOrigins,
    extensionOrigins,
    sessionSecret,
    encryptionKey,
    google,
    providers,
  };
}

export function loadEnvironment() {
  config({ path: resolve(__dirname, '../../.env'), quiet: true });
  return validateEnvironment(process.env);
}
