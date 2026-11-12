import 'reflect-metadata';
import { ApiErrorCode } from '@filecab/contracts';
import type { ArgumentsHost } from '@nestjs/common';
import { expect, test, vi } from 'vitest';
import { ApiException, ApiExceptionFilter } from './api-error';

const sentry = vi.hoisted(() => ({
  setContext: vi.fn(),
  setTag: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/nestjs', () => ({
  withScope: (callback: (scope: typeof sentry) => void) => callback(sentry),
  captureException: sentry.captureException,
}));

test('Sentry identifies the incoming endpoint without private query, headers, body or path values', () => {
  const request = {
    method: 'PATCH',
    route: { path: '/api/v1/library/:id' },
    originalUrl: '/api/v1/library/private-id?token=private-token',
    headers: { authorization: 'Bearer private-token' },
    body: { comment: 'private-note' },
    params: { id: 'private-id' },
  };
  const response = { headersSent: true, getHeader: () => 'correlation-fixture' };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new ApiExceptionFilter().catch(
    new ApiException(502, ApiErrorCode.InvalidResponse, 'Provider response is invalid'),
    host,
  );

  expect(sentry.setContext).toHaveBeenCalledWith('api_request', {
    method: 'PATCH',
    route: '/api/v1/library/:id',
  });
  expect(JSON.stringify(sentry.setContext.mock.calls)).not.toContain('private-');
  expect(sentry.captureException).toHaveBeenCalledTimes(1);
});
