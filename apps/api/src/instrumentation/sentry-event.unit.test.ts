import 'reflect-metadata';
import * as Sentry from '@sentry/nestjs';
import { afterEach, expect, test } from 'vitest';
import { ApiErrorCode } from '@filecab/contracts';
import { ApiException, sendApiError } from '../http/api-error';
import { sanitizeSentryEvent } from './sentry-event';

afterEach(async () => {
  await Sentry.close(1000);
});

test('handled provider schema failures produce a sanitized event through the real SDK transport', async () => {
  const events: Sentry.ErrorEvent[] = [];
  Sentry.init({
    dsn: 'https://public@example.test/1',
    defaultIntegrations: false,
    beforeSend: sanitizeSentryEvent,
    transport: () => ({
      send: async (envelope) => {
        for (const [header, payload] of envelope[1]) {
          if (header.type === 'event') events.push(payload as Sentry.ErrorEvent);
        }

        return { statusCode: 200 };
      },
      flush: async () => true,
    }),
  });
  const response = {
    headersSent: true,
    getHeader: () => 'correlation-fixture',
    req: {
      method: 'GET',
      route: { path: '/api/v1/catalog/search' },
      originalUrl: '/api/v1/catalog/search?query=private-search',
      headers: { authorization: 'private-key' },
    },
  };
  sendApiError(
    new ApiException(
      502,
      ApiErrorCode.InvalidResponse,
      'Kinopoisk returned an invalid catalog response',
      true,
      undefined,
      undefined,
      {
        provider: 'kinopoisk',
        origin: 'https://api.poiskkino.dev',
        operation: 'search',
        stage: 'schema',
        elapsedMs: 1,
        validationFields: ['docs.0.year'],
      },
    ),
    response as never,
  );
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].contexts?.provider_failure?.validationFields).toEqual(['docs.0.year']);
  expect(events[0].request).toEqual({ method: 'GET', url: '/api/v1/catalog/search' });
  expect(events[0].tags?.correlation_id).toBe('correlation-fixture');
  expect(JSON.stringify(events)).not.toContain('private-');
});
