import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const local: Record<string, unknown> = {};
  const session: Record<string, unknown> = {};
  const area = (data: Record<string, unknown>) => ({
    setAccessLevel: vi.fn(async () => {}),
    get: vi.fn(async (key: string) => ({ [key]: data[key] })),
    set: vi.fn(async (value: object) => {
      Object.assign(data, value);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    }),
  });
  const browser = {
    storage: { local: area(local), session: area(session) },
    runtime: {
      id: 'fixture',
      getURL: (path: string) => `chrome-extension://fixture${path}`,
      onMessage: { addListener: vi.fn() },
      sendMessage: vi.fn(async () => {}),
    },
    identity: {
      getRedirectURL: () => 'https://fixture.chromiumapp.org/filecab',
      launchWebAuthFlow: vi.fn<(input: { url: string }) => Promise<string>>(),
    },
  };

  return { local, session, browser };
});

vi.mock('wxt/browser', () => ({ browser: mocks.browser }));

const tokens = {
  schemaVersion: 1,
  ownerId: 'fixture-owner',
  accessToken: 'private-access',
  refreshToken: 'private-refresh',
  accessExpiresAt: new Date(Date.now() + 900000).toISOString(),
  sessionExpiresAt: new Date(Date.now() + 2592000000).toISOString(),
};

const sender = { id: 'fixture', url: 'chrome-extension://fixture/popup.html' };

type MessageHandler = (
  message: unknown,
  sender: { id: string; url: string },
) => Promise<unknown> | undefined;

/** Initializes an isolated worker against mocked trusted and untrusted browser contexts. */
async function worker(): Promise<MessageHandler> {
  const { registerAuthWorker } = await import('./worker');
  registerAuthWorker();

  return mocks.browser.runtime.onMessage.addListener.mock.calls.at(-1)![0] as MessageHandler;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const data of [mocks.local, mocks.session])
    for (const key of Object.keys(data)) delete data[key];
  vi.stubGlobal('fetch', vi.fn());
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

test('content scripts cannot start login or receive credentials; storage is restricted', async () => {
  const handler = await worker();
  expect(
    handler({ action: 'auth.login' }, { id: 'fixture', url: 'https://example.com/' }),
  ).toBeUndefined();
  await handler({ action: 'auth.status' }, sender);
  expect(mocks.browser.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  expect(mocks.browser.storage.local.setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
  expect(mocks.browser.storage.session.setAccessLevel).toHaveBeenCalledWith({
    accessLevel: 'TRUSTED_CONTEXTS',
  });
});

test('simultaneous UI requests serialize refresh and receive only account state', async () => {
  mocks.local['filecab.auth.refresh'] = { ownerId: tokens.ownerId, refreshToken: 'old-refresh' };
  let refreshes = 0;
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).endsWith('/refresh')) {
      refreshes++;

      return new Response(JSON.stringify(tokens));
    }

    return new Response(JSON.stringify({ schemaVersion: 1, ownerId: tokens.ownerId }));
  });
  const handler = await worker();
  const replies = await Promise.all([
    handler({ action: 'auth.status' }, sender),
    handler({ action: 'auth.status' }, sender),
  ]);
  expect(refreshes).toBe(1);
  expect(replies).toEqual([
    { account: { schemaVersion: 1, ownerId: tokens.ownerId } },
    { account: { schemaVersion: 1, ownerId: tokens.ownerId } },
  ]);
  expect(JSON.stringify(replies)).not.toContain(tokens.refreshToken);
  expect(mocks.session['filecab.auth.access']).toHaveProperty('accessToken', tokens.accessToken);
});

test('uncertain refresh outcomes consume local credentials before sending and cannot replay after restart', async () => {
  mocks.local['filecab.auth.refresh'] = { ownerId: tokens.ownerId, refreshToken: 'old-refresh' };
  vi.mocked(fetch).mockImplementation(async () => {
    expect(mocks.local['filecab.auth.refresh']).toBeUndefined();
    expect(mocks.session['filecab.auth.access']).toBeUndefined();
    throw new Error('private-server-payload');
  });
  let handler = await worker();
  expect(await handler({ action: 'auth.status' }, sender)).toMatchObject({
    account: null,
    diagnostic: { stage: 'refresh', code: 'API_UNREACHABLE' },
  });
  handler = await worker();
  expect(await handler({ action: 'auth.status' }, sender)).toEqual({ account: null });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('interactive login binds the callback attempt and never puts reusable tokens in the launch URL', async () => {
  mocks.browser.identity.launchWebAuthFlow.mockImplementation(async ({ url }) => {
    const launch = new URL(url);
    expect(launch.searchParams.has('verifier')).toBe(false);
    expect(launch.searchParams.has('refreshToken')).toBe(false);

    return `https://fixture.chromiumapp.org/filecab?${new URLSearchParams({ attempt: launch.searchParams.get('attempt')!, code: 'one-use-code' })}`;
  });
  vi.mocked(fetch).mockImplementation(async (_url, init) => {
    if (String(_url).includes('/extension/config?'))
      return new Response(
        JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: true }),
      );

    const body = JSON.parse(String(init?.body)) as {
      code: string;
      verifier: string;
      attempt: string;
    };
    const stored = mocks.session['filecab.auth.login'] as { attempt: string; verifier: string };
    expect(body.verifier).toBe(stored.verifier);
    expect(body.attempt).toBe(stored.attempt);

    return new Response(JSON.stringify(tokens));
  });
  const handler = await worker();
  expect(await handler({ action: 'auth.login' }, sender)).toEqual({
    account: { schemaVersion: 1, ownerId: tokens.ownerId },
  });
  expect(mocks.session['filecab.auth.login']).toBeUndefined();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('missing extension allowlist is diagnosed before opening Google and preserves credentials', async () => {
  mocks.local['filecab.auth.refresh'] = {
    ownerId: tokens.ownerId,
    refreshToken: tokens.refreshToken,
  };
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: false }),
    ),
  );
  const handler = await worker();
  const reply = await handler({ action: 'auth.login' }, sender);
  expect(reply).toMatchObject({
    account: null,
    diagnostic: { stage: 'configuration', code: 'EXTENSION_NOT_ALLOWED' },
    debug: { extensionOrigin: 'chrome-extension://fixture' },
  });
  expect(mocks.browser.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  expect(mocks.local['filecab.auth.refresh']).toHaveProperty('refreshToken', tokens.refreshToken);
  expect(JSON.stringify(reply)).not.toContain(tokens.refreshToken);
});

test('exchange rejection reports HTTP status and request ID without logging response or browser URLs', async () => {
  const requestId = '11111111-1111-4111-8111-111111111111';
  mocks.browser.identity.launchWebAuthFlow.mockImplementation(async ({ url }) => {
    const launch = new URL(url);

    return `https://fixture.chromiumapp.org/filecab?${new URLSearchParams({ attempt: launch.searchParams.get('attempt')!, code: 'private-one-use-code' })}`;
  });
  vi.mocked(fetch).mockImplementation(async (url) => {
    if (String(url).includes('/extension/config?'))
      return new Response(
        JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: true }),
      );

    return new Response('private-server-secret', {
      status: 401,
      headers: { 'X-Correlation-ID': requestId },
    });
  });
  const handler = await worker();
  const reply = await handler({ action: 'auth.login' }, sender);
  expect(reply).toMatchObject({
    diagnostic: {
      stage: 'exchange',
      code: 'SESSION_REJECTED',
      status: 401,
      correlationId: requestId,
    },
  });
  const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
  for (const value of [
    'private-server-secret',
    'private-one-use-code',
    'code_challenge',
    'verifier',
  ])
    expect(logs).not.toContain(value);
});

test('trusted UI query variants can run diagnostics while content-script contexts remain rejected', async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ schemaVersion: 1, googleEnabled: true, extensionAllowed: true })),
  );
  const handler = await worker();
  expect(
    await handler(
      { action: 'auth.diagnostics' },
      { ...sender, url: sender.url + '?debug=1#details' },
    ),
  ).toMatchObject({
    account: null,
    debug: { extensionId: 'fixture', apiOrigin: 'http://127.0.0.1:3001' },
  });
  expect(
    handler({ action: 'auth.diagnostics' }, { ...sender, url: 'https://fixture/popup.html' }),
  ).toBeUndefined();
});
