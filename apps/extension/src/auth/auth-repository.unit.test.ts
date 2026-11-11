import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      id: 'fixture-extension',
      sendMessage: mocks.sendMessage,
      onMessage: { addListener: mocks.addListener, removeListener: mocks.removeListener },
    },
    identity: { getRedirectURL: () => 'https://fixture-extension.chromiumapp.org/filecab' },
  },
}));

import { ExtensionAuthRepository } from './auth-repository';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sendMessage.mockResolvedValue({ account: null });
});

test('shares one worker listener, refreshes on auth changes and cleans up the last subscription', async () => {
  const repository = new ExtensionAuthRepository();
  const first = repository.subscribe(() => {});
  const second = repository.subscribe(() => {});
  await vi.waitFor(() => expect(repository.getSnapshot().busy).toBe(false));
  expect(mocks.addListener).toHaveBeenCalledTimes(1);
  expect(mocks.sendMessage).toHaveBeenCalledWith({ action: 'auth.status' });
  const changed = mocks.addListener.mock.calls[0]![0];
  mocks.sendMessage.mockResolvedValue({ account: { schemaVersion: 1, ownerId: 'worker-owner' } });
  changed({ action: 'auth.changed' });
  await vi.waitFor(() => expect(repository.getSnapshot().account?.ownerId).toBe('worker-owner'));
  first();
  expect(mocks.removeListener).not.toHaveBeenCalled();
  second();
  expect(mocks.removeListener).toHaveBeenCalledWith(changed);
});

test('maps worker diagnostics and public connection details into the shared error contract', async () => {
  const repository = new ExtensionAuthRepository();
  const diagnostic = {
    stage: 'configuration',
    code: 'HTTP_REJECTED',
    status: 403,
    correlationId: 'request-1',
  };
  mocks.sendMessage.mockResolvedValue({
    account: null,
    error: 'The API rejected this operation.',
    diagnostic,
    debug: {
      extensionId: 'fixture-extension',
      apiOrigin: 'https://api.test',
      extensionOrigin: 'chrome-extension://fixture-extension',
      redirectUrl: 'https://fixture-extension.chromiumapp.org/filecab',
    },
  });
  await repository.signIn();
  expect(mocks.sendMessage).toHaveBeenCalledWith({ action: 'auth.login' });
  expect(repository.getSnapshot()).toEqual({
    account: null,
    busy: false,
    error: {
      message: 'The API rejected this operation.',
      diagnostic,
      connectionDetails: [
        { label: 'Extension ID', value: 'fixture-extension' },
        { label: 'API', value: 'https://api.test' },
        { label: 'Allowed origin needed', value: 'chrome-extension://fixture-extension' },
        { label: 'Extension callback', value: 'https://fixture-extension.chromiumapp.org/filecab' },
      ],
    },
  });
  mocks.sendMessage.mockResolvedValue({ account: null });
  await repository.signOut();
  expect(mocks.sendMessage).toHaveBeenLastCalledWith({ action: 'auth.logout' });
  expect(repository.getSnapshot().error).toBeNull();
  await repository.signOutAll();
  expect(mocks.sendMessage).toHaveBeenLastCalledWith({ action: 'auth.logoutAll' });
});

test('turns a missing worker response into safe shared messaging diagnostics', async () => {
  const repository = new ExtensionAuthRepository();
  mocks.sendMessage.mockResolvedValue(undefined);
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  try {
    await repository.signIn();
    expect(repository.getSnapshot()).toMatchObject({
      account: null,
      busy: false,
      error: {
        message:
          'The extension worker did not reply. Reload the extension and inspect its service worker console.',
        diagnostic: { stage: 'messaging', code: 'WORKER_UNAVAILABLE' },
      },
    });
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
