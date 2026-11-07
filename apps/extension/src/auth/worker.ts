import {
  SyncOperation,
  ApiErrorCode,
  SyncErrorCode,
  type AccountInfo,
  type ExtensionSession,
  type ExtensionLoginConfig,
} from '@filecab/contracts';
import { browser } from 'wxt/browser';
import {
  AuthFailure,
  AuthFailureCode,
  AuthStage,
  authStep,
  type AuthDiagnostic,
} from './diagnostics';

import { API_ORIGIN, debugContext, type AuthDebugContext } from './connection';

const REFRESH_KEY = 'filecab.auth.refresh';

const ACCESS_KEY = 'filecab.auth.access';

const LOGIN_KEY = 'filecab.auth.login';

const LIBRARY_ROUTES = new Map<string, string>([
  [SyncOperation.Snapshot, 'library'],
  [SyncOperation.Pull, 'replication/pull'],
  [SyncOperation.Push, 'replication/push'],
]);

const SYNC_HTTP_ERRORS: Partial<Record<number, ApiErrorCode | SyncErrorCode>> = {
  400: ApiErrorCode.ValidationError,
  401: SyncErrorCode.AccountChanged,
  403: ApiErrorCode.Forbidden,
  404: SyncErrorCode.ApiOutdated,
  413: ApiErrorCode.PayloadTooLarge,
  429: ApiErrorCode.RateLimited,
  503: ApiErrorCode.ServiceUnavailable,
};

const AUTH_HTTP_ERRORS: Partial<Record<number, AuthFailureCode>> = {
  401: AuthFailureCode.SessionRejected,
  404: AuthFailureCode.ApiOutdated,
};

const AUTH_ACTION_STAGES: Partial<Record<string, AuthStage>> = {
  'auth.login': AuthStage.BrowserLogin,
  'auth.logout': AuthStage.Logout,
  'auth.logoutAll': AuthStage.Logout,
};

/** Stores durable refresh credentials only in the trusted extension local area. */
interface StoredRefresh {
  ownerId: string;
  refreshToken: string;
}

/** Stores short-lived access credentials only in the trusted session area. */
interface StoredAccess {
  ownerId: string;
  accessToken: string;
  accessExpiresAt: string;
}

/** Returns only account state to extension pages; never includes credentials. */
export interface AuthReply {
  account: AccountInfo | null;
  error?: string;
  diagnostic?: AuthDiagnostic;
  debug?: AuthDebugContext;
}

/** Fetches auth endpoints with a bounded wait and only safe HTTP error metadata. */
async function authFetch(
  stage: AuthStage,
  path: string,
  init?: RequestInit,
  allowUnauthorized = false,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/v1/auth/${path}`, {
      ...init,
      credentials: 'omit',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new AuthFailure({ stage, code: AuthFailureCode.ApiUnreachable });
  }

  if (!response.ok && !(allowUnauthorized && response.status === 401)) {
    const requestId = response.headers.get('X-Correlation-ID');
    const correlationId = requestId && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : undefined;
    const code =
      stage === AuthStage.Configuration && response.status === 403
        ? AuthFailureCode.ExtensionNotAllowed
        : (AUTH_HTTP_ERRORS[response.status] ?? AuthFailureCode.HttpRejected);

    throw new AuthFailure({ stage, code, status: response.status, correlationId });
  }

  return response;
}

/** Detects a disabled provider or missing allowlist before opening an interactive window. */
async function checkConfiguration(): Promise<void> {
  await authStep(AuthStage.Configuration, async () => {
    const response = await authFetch(
      AuthStage.Configuration,
      `extension/config?${new URLSearchParams({ extensionId: browser.runtime.id })}`,
    );
    const config = (await response.json()) as ExtensionLoginConfig;

    if (!config.googleEnabled)
      throw new AuthFailure({
        stage: AuthStage.Configuration,
        code: AuthFailureCode.GoogleDisabled,
      });

    if (!config.extensionAllowed)
      throw new AuthFailure({
        stage: AuthStage.Configuration,
        code: AuthFailureCode.ExtensionNotAllowed,
      });
  });
}

/** Encodes random bytes or a digest in URL-safe base64. */
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Restricts credential stores before reading or writing any authentication state. */
async function restrictStorage(): Promise<void> {
  await browser.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

/** Removes credentials without changing a guest or account library. */
async function clearCredentials(): Promise<void> {
  await browser.storage.local.remove(REFRESH_KEY);
  await browser.storage.session.remove([ACCESS_KEY, LOGIN_KEY]);
}

/** Persists refresh state before acknowledging the new short-lived access token. */
async function storeSession(session: ExtensionSession): Promise<void> {
  await browser.storage.local.set({
    [REFRESH_KEY]: {
      ownerId: session.ownerId,
      refreshToken: session.refreshToken,
    } satisfies StoredRefresh,
  });
  await browser.storage.session.set({
    [ACCESS_KEY]: {
      ownerId: session.ownerId,
      accessToken: session.accessToken,
      accessExpiresAt: session.accessExpiresAt,
    } satisfies StoredAccess,
  });
}

/** Refreshes once with durable consumption before the network request to prevent restart replay. */
async function accessCredential(): Promise<StoredAccess | null> {
  const current = (await browser.storage.session.get(ACCESS_KEY))[ACCESS_KEY] as
    StoredAccess | undefined;

  if (current && Date.parse(current.accessExpiresAt) > Date.now() + 5000) return current;

  const refresh = (await browser.storage.local.get(REFRESH_KEY))[REFRESH_KEY] as
    StoredRefresh | undefined;

  if (!refresh) return null;

  await clearCredentials();
  const response = await authFetch(
    AuthStage.Refresh,
    'refresh',
    {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh.refreshToken }),
    },
    true,
  );

  if (response.status === 401) return null;

  if (!response.ok) throw new Error('Authentication unavailable');

  const session = (await response.json()) as ExtensionSession;

  if (session.ownerId !== refresh.ownerId) throw new Error('Account changed during refresh');

  await storeSession(session);

  return session;
}

/** Reads server-committed account state and recovers an expired or revoked access token once. */
async function accountState(): Promise<AccountInfo | null> {
  let access = await accessCredential();

  if (!access) return null;

  const request = (token: string) =>
    authFetch(
      AuthStage.Account,
      'me',
      {
        credentials: 'omit',
        headers: { Authorization: `Bearer ${token}` },
      },
      true,
    );
  let response = await request(access.accessToken);

  if (response.status === 401) {
    await browser.storage.session.remove(ACCESS_KEY);
    access = await accessCredential();

    if (!access) return null;

    response = await request(access.accessToken);
  }

  if (response.status === 401) {
    await clearCredentials();

    return null;
  }

  if (!response.ok) throw new Error('Authentication unavailable');

  return response.json() as Promise<AccountInfo>;
}

/** Starts an interactive attempt-bound code flow entirely in the privileged worker. */
async function login(): Promise<AccountInfo> {
  await checkConfiguration();
  await clearCredentials();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const attempt = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  const returnTo = browser.identity.getRedirectURL('filecab');
  const url = new URL(`${API_ORIGIN}/api/v1/auth/google/start`);
  url.search = new URLSearchParams({
    client: 'extension',
    returnTo,
    challenge,
    attempt,
  }).toString();
  await browser.storage.session.set({ [LOGIN_KEY]: { attempt, verifier } });
  try {
    const returned = await authStep(AuthStage.BrowserLogin, async () => {
      try {
        return await browser.identity.launchWebAuthFlow({ url: url.href, interactive: true });
      } catch (error) {
        if (
          error instanceof Error &&
          /user did not approve|cancelled|canceled/i.test(error.message)
        )
          throw new AuthFailure({
            stage: AuthStage.BrowserLogin,
            code: AuthFailureCode.LoginCancelled,
          });

        throw new AuthFailure({
          stage: AuthStage.BrowserLogin,
          code: AuthFailureCode.BrowserLoginFailed,
        });
      }
    });

    if (!returned)
      throw new AuthFailure({
        stage: AuthStage.BrowserLogin,
        code: AuthFailureCode.LoginCancelled,
      });

    const callback = new URL(returned);
    const expected = new URL(returnTo);
    const stored = (await browser.storage.session.get(LOGIN_KEY))[LOGIN_KEY] as
      { attempt: string; verifier: string } | undefined;

    if (
      callback.origin !== expected.origin ||
      callback.pathname !== expected.pathname ||
      callback.searchParams.get('attempt') !== attempt ||
      stored?.attempt !== attempt
    )
      throw new AuthFailure({ stage: AuthStage.Callback, code: AuthFailureCode.CallbackMismatch });

    const response = await authFetch(AuthStage.Exchange, 'exchange', {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: callback.searchParams.get('code'),
        attempt,
        verifier: stored.verifier,
      }),
    });

    if (!response.ok) throw new Error('Login failed');

    const session = (await response.json()) as ExtensionSession;
    await storeSession(session);

    return { schemaVersion: 1, ownerId: session.ownerId };
  } finally {
    await browser.storage.session.remove(LOGIN_KEY);
  }
}

/** Revokes server access before clearing only authentication state locally. */
async function logout(all: boolean): Promise<void> {
  try {
    const access = await accessCredential();

    if (!access) return;

    const response = await authFetch(
      AuthStage.Logout,
      all ? 'logout-all' : 'logout',
      {
        method: 'POST',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${access.accessToken}` },
      },
      true,
    );

    if (!response.ok && response.status !== 401) throw new Error('Sign out failed');
  } finally {
    await clearCredentials();
  }
}

/** Allows the extension UI pages, including query/fragment variants used during debugging. */
function trustedPage(sender: { id?: string; url?: string }): boolean {
  if (sender.id !== browser.runtime.id || !sender.url) return false;

  try {
    const page = new URL(sender.url);
    const extension = new URL(browser.runtime.getURL('/'));

    return (
      page.protocol === extension.protocol &&
      page.host === extension.host &&
      ['/popup.html', '/full-page.html'].includes(page.pathname)
    );
  } catch {
    return false;
  }
}

/** Recognizes the reset-required code without asserting a complete API error envelope. */
function isSyncResetRequired(data: unknown): data is { code: ApiErrorCode.SyncResetRequired } {
  return (
    data !== null &&
    typeof data === 'object' &&
    'code' in data &&
    data.code === ApiErrorCode.SyncResetRequired
  );
}

/** Fetches only library/replication routes after verifying the captured account identity. */
async function libraryRequest(message: object): Promise<unknown> {
  const input = message as { ownerId?: string; operation?: string; body?: unknown };
  const route = LIBRARY_ROUTES.get(String(input.operation));

  if (!route || typeof input.ownerId !== 'string') return { error: SyncErrorCode.InvalidRequest };

  const access = await accessCredential();

  if (!access || access.ownerId !== input.ownerId) return { error: SyncErrorCode.AccountChanged };

  const operation = input.operation as
    SyncOperation.Snapshot | SyncOperation.Pull | SyncOperation.Push;
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}/api/v1/${route}`, {
      method: operation === SyncOperation.Snapshot ? 'GET' : 'POST',
      credentials: 'omit',
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        ...(operation === SyncOperation.Snapshot ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(operation === SyncOperation.Snapshot ? {} : { body: JSON.stringify(input.body) }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return {
      error: SyncErrorCode.NetworkError,
      diagnostic: { code: SyncErrorCode.NetworkError, operation },
    };
  }

  const requestId = response.headers.get('X-Correlation-ID');
  const correlationId =
    requestId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)
      ? requestId
      : undefined;
  const diagnostic = {
    operation,
    status: response.status,
    ...(correlationId ? { correlationId } : {}),
  };
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (response.ok)
      return {
        error: ApiErrorCode.InvalidResponse,
        diagnostic: { ...diagnostic, code: ApiErrorCode.InvalidResponse },
      };
  }

  if (response.ok) return { data };

  let code = SYNC_HTTP_ERRORS[response.status];

  if (!code) {
    code = response.status >= 500 ? SyncErrorCode.ServerError : SyncErrorCode.RequestFailed;
  }

  if (isSyncResetRequired(data)) code = data.code;

  return { error: code, diagnostic: { ...diagnostic, code } };
}

/** Registers serialized auth operations restricted to the extension's own UI pages. */
export function registerAuthWorker(): void {
  const ready = authStep(AuthStage.Storage, restrictStorage);
  // Handle initialization failure immediately; accepted messages still receive its safe diagnostic.
  void ready.catch(() => {});
  let queue: Promise<unknown> = Promise.resolve();
  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    if (
      !trustedPage(sender) ||
      typeof message !== 'object' ||
      message === null ||
      !('action' in message)
    )
      return;

    const action = message.action;

    if (
      ![
        'auth.status',
        'auth.login',
        'auth.logout',
        'auth.logoutAll',
        'auth.diagnostics',
        'sync.request',
      ].includes(String(action))
    )
      return;

    const stage = AUTH_ACTION_STAGES[String(action)] ?? AuthStage.Account;
    const execute = async (): Promise<unknown> => {
      await ready;

      if (action === 'sync.request') return libraryRequest(message);

      if (action === 'auth.diagnostics') {
        await checkConfiguration();

        return { account: null, debug: debugContext() };
      }

      if (action === 'auth.login') return { account: await login() };

      if (action === 'auth.logout' || action === 'auth.logoutAll') {
        await logout(action === 'auth.logoutAll');

        return { account: null };
      }

      return { account: await accountState() };
    };
    const operation =
      action === 'auth.diagnostics' ? execute() : queue.then(() => authStep(stage, execute));

    if (action !== 'auth.status' && action !== 'auth.diagnostics' && action !== 'sync.request')
      void operation
        .then(() => browser.runtime.sendMessage({ action: 'auth.changed' }))
        .catch(() => {});

    if (action !== 'auth.diagnostics') queue = operation.catch(() => {});

    return operation.catch((error: unknown) => {
      if (action === 'sync.request') return { error: SyncErrorCode.RequestFailed };

      const failure =
        error instanceof AuthFailure
          ? error
          : new AuthFailure({ stage, code: AuthFailureCode.HttpRejected });

      return {
        account: null,
        error: failure.message,
        diagnostic: failure.diagnostic,
        debug: debugContext(),
      };
    });
  });
}
