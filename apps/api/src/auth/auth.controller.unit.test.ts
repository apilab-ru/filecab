import 'reflect-metadata';
import { expect, test, vi } from 'vitest';
import { ApiErrorCode } from '@filecab/contracts';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

const extensionId = 'a'.repeat(32);

const auth = {
  environment: {
    google: { enabled: true },
    extensionOrigins: [`chrome-extension://${extensionId}`],
  },
} as AuthService;

test('extension login preflight reports unavailable storage before opening browser login', async () => {
  const check = vi.fn().mockRejectedValue(new Error('private database connection detail'));
  const controller = new AuthController(auth, { check });
  await expect(controller.extensionConfig({ extensionId })).rejects.toMatchObject({
    httpStatus: 503,
    code: ApiErrorCode.ServiceUnavailable,
    retryable: true,
    message: 'Service temporarily unavailable',
  });
});

test('extension login preflight returns public configuration after storage recovers', async () => {
  const controller = new AuthController(auth, { check: async () => {} });
  await expect(controller.extensionConfig({ extensionId })).resolves.toEqual({
    schemaVersion: 1,
    googleEnabled: true,
    extensionAllowed: true,
  });
});
