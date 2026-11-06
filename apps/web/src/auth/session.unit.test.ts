import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const send = vi.fn();
const lock = vi.fn(async (_name: string, action: () => Promise<void>) => action());

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      postMessage = send;
      onmessage = null;
    },
  );
  vi.stubGlobal('navigator', { locks: { request: lock } });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test('concurrent unauthorized requests share one refresh and use trusted cookie headers', async () => {
  const ownerId = 'fixture-owner';
  let authorized = false;
  const requests: RequestInit[] = [];
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (String(url).endsWith('/refresh')) {
      requests.push(init!);
      authorized = true;

      return new Response('{}', { status: 200 });
    }

    return new Response(JSON.stringify({ schemaVersion: 1, ownerId }), {
      status: authorized ? 200 : 401,
    });
  });
  const { currentAccount } = await import('./session');
  const accounts = await Promise.all([currentAccount(), currentAccount()]);
  expect(accounts).toEqual([
    { schemaVersion: 1, ownerId },
    { schemaVersion: 1, ownerId },
  ]);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    credentials: 'include',
    headers: { 'X-Filecab-Request': '1' },
  });
});

test('changing accounts removes prior private query and mutation caches', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1, ownerId: 'first' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1, ownerId: 'second' })));
  const { currentAccount, queryClient } = await import('./session');
  await currentAccount();
  queryClient.setQueryData(['library', 'first'], ['private-entry']);
  await currentAccount();
  expect(queryClient.getQueryData(['library', 'first'])).toBeUndefined();
  expect(send).toHaveBeenLastCalledWith({ ownerId: 'second' });
  queryClient.clear();
});

test('logout cancels account caches and never writes credentials to browser storage', async () => {
  const setItem = vi.fn();
  vi.stubGlobal('localStorage', { setItem });
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify({ schemaVersion: 1, ownerId: 'first' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const { logout, queryClient } = await import('./session');
  queryClient.setQueryData(['library', 'first'], ['private-entry']);
  await logout();
  expect(queryClient.getQueryData(['library', 'first'])).toBeUndefined();
  expect(queryClient.getQueryData(['account'])).toBeNull();
  expect(setItem).not.toHaveBeenCalled();
  expect(send).toHaveBeenLastCalledWith({ ownerId: null });
});
