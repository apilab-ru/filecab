import { sanitizeSentryEvent } from './sentry-event';
import * as Sentry from '@sentry/nestjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

Sentry.init({
  dsn: process.env.SENTRY_DSN?.trim() || undefined,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0,
  beforeSend: sanitizeSentryEvent,
});
