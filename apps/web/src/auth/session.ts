import type { AccountInfo } from '@filecab/contracts';
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? 'http://127.0.0.1:3001';

const authEvents =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('filecab-auth');

let refresh: Promise<void> | null = null;

let knownOwner: string | null | undefined;

/** Cancels private requests before removing every account-scoped query and mutation. */
export async function clearAccountCache(broadcast = true): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'account' });
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(['account'], null);

  if (broadcast) {
    knownOwner = null;
    authEvents?.postMessage({ ownerId: null });
  }
}

if (authEvents)
  authEvents.onmessage = (event: MessageEvent<{ ownerId: string | null }>) => {
    if (event.data.ownerId === knownOwner) return;
    knownOwner = event.data.ownerId;
    void clearAccountCache(false)
      .then(() =>
        queryClient.fetchQuery({
          queryKey: ['account'],
          queryFn: ({ signal }) => currentAccount(signal),
        }),
      )
      .catch(() => {});
  };

/** Reads the current website account using HttpOnly access and serialized cookie refresh. */
export async function currentAccount(signal?: AbortSignal): Promise<AccountInfo | null> {
  const request = () => fetch(`${API_ORIGIN}/api/v1/auth/me`, { credentials: 'include', signal });
  let response = await request();

  if (response.status === 401) {
    if (!refresh) {
      const rotate = async () => {
        // A different tab may already have rotated the shared cookies while this one waited.
        const current = await fetch(`${API_ORIGIN}/api/v1/auth/me`, { credentials: 'include' });

        if (current.status !== 401) return;
        await fetch(`${API_ORIGIN}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Filecab-Request': '1' },
          body: '{}',
        });
      };
      refresh = (async () => {
        if (navigator.locks) await navigator.locks.request('filecab-session-refresh', rotate);
        else await rotate();
      })().finally(() => {
        refresh = null;
      });
    }
    await refresh;
    response = await request();
  }

  if (response.status !== 401 && !response.ok) throw new Error('Account service unavailable');

  const account = response.status === 401 ? null : ((await response.json()) as AccountInfo);
  signal?.throwIfAborted();
  const ownerId = account?.ownerId ?? null;

  if (ownerId !== knownOwner) {
    const previous = knownOwner;
    knownOwner = ownerId;

    if (previous !== undefined) {
      await queryClient.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'account' });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'account' });
      queryClient.getMutationCache().clear();
    }
    authEvents?.postMessage({ ownerId });
  }

  return account;
}

/** Clears old account caches before navigating to the browser-bound Google flow. */
export async function login(): Promise<void> {
  await clearAccountCache();
  const url = new URL(`${API_ORIGIN}/api/v1/auth/google/start`);
  url.search = new URLSearchParams({
    client: 'website',
    returnTo: `${location.origin}/`,
  }).toString();
  location.assign(url.href);
}

/** Revokes the current website session and clears account caches in every open tab. */
export async function logout(all = false): Promise<void> {
  const account = await currentAccount();

  if (account) {
    const response = await fetch(`${API_ORIGIN}/api/v1/auth/${all ? 'logout-all' : 'logout'}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Filecab-Request': '1' },
    });

    if (!response.ok) throw new Error('Sign out failed; please retry');
  }
  await clearAccountCache();
}
