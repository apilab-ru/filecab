import * as Sentry from '@sentry/nestjs';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0,
  beforeSend(event) {
    const safeMessage =
      typeof event.contexts?.api_error?.message === 'string'
        ? event.contexts.api_error.message
        : 'Unhandled API error';
    const apiRequest = event.contexts?.api_request;
    event.request =
      typeof apiRequest?.method === 'string' && typeof apiRequest?.route === 'string'
        ? { method: apiRequest.method, url: apiRequest.route }
        : undefined;
    event.user = undefined;
    event.extra = undefined;
    event.breadcrumbs = [];
    event.transaction = undefined;
    event.contexts = {
      runtime: event.contexts?.runtime,
      api_error: event.contexts?.api_error,
      api_request: apiRequest,
      provider_failure: event.contexts?.provider_failure,
    };
    event.message = safeMessage;
    event.logentry = undefined;

    if (event.exception?.values)
      event.exception.values = event.exception.values.map((exception) => ({
        ...exception,
        value: safeMessage,
      }));

    return event;
  },
});
