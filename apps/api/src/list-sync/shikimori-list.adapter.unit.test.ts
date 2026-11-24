import 'reflect-metadata';
import { describe, expect, test } from 'vitest';
import { Status } from '@filecab/contracts';
import {
  ListSyncAuthorizationError,
  ListSyncProviderError,
  ListSyncUnsupportedValueError,
  type ListSyncCredentials,
  type RemoteListRecord,
} from './list-sync-adapter';
import { ShikimoriListAdapter } from './shikimori-list.adapter';

const CONFIG = {
  origin: 'https://shikimori.io',
  clientId: 'client',
  clientSecret: 'secret',
  callbackUrl: 'https://api.filecab.test/api/v1/list-sync/shikimori/callback',
  userAgent: 'Filecab test',
};
const CREDENTIALS: ListSyncCredentials = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiresAt: null,
  scopes: ['user_rates'],
};
const ACCOUNT = { accountId: '7', accountName: 'owner' };

/** Records requests and answers them from a queue of responses. */
function fakeFetch(responses: Array<Response | Error>) {
  const requests: Array<{ method: string; url: URL; headers: Headers; body: string | null }> = [];
  const fetcher = (async (input: URL, init?: RequestInit) => {
    requests.push({
      method: init?.method ?? 'GET',
      url: new URL(input),
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : null,
    });
    const next = responses.shift();

    if (!next) throw new Error('Unexpected request');

    if (next instanceof Error) throw next;

    return next;
  }) as typeof fetch;

  return { requests, fetcher };
}

/** Builds a JSON response. */
function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** Builds one anime list record. */
function listRate(id: number, status: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    score: 7,
    status,
    text: 'private note',
    text_html: '<b>private note</b>',
    episodes: 3,
    rewatches: 1,
    created_at: '2026-01-01T00:00:00.000+03:00',
    updated_at: '2026-02-01T00:00:00.000+03:00',
    user: { id: 7 },
    anime: {
      id: id + 1000,
      name: 'Hoshi',
      russian: 'Звезда',
      image: { original: '/system/animes/original/1.jpg' },
      episodes: 12,
      aired_on: '2024-04-05',
    },
    manga: null,
    ...extra,
  };
}

/** Builds one user rate of the v2 API. */
function userRate(extra: Record<string, unknown> = {}) {
  return {
    id: 50,
    user_id: 7,
    target_id: 1001,
    target_type: 'Anime',
    score: 0,
    status: 'watching',
    rewatches: 2,
    episodes: 0,
    text: 'keep me',
    ...extra,
  };
}

/** Creates an adapter with a gate that never waits. */
function adapterWith(responses: Array<Response | Error>) {
  const { requests, fetcher } = fakeFetch(responses);
  let gated = 0;
  const adapter = new ShikimoriListAdapter(
    CONFIG,
    {
      acquire: async () => {
        gated += 1;
      },
    },
    fetcher,
  );

  return { adapter, requests, gated: () => gated };
}

/** A remote record that writes target. */
const RECORD = { recordId: '50' } as RemoteListRecord;

describe('Shikimori OAuth', () => {
  test('requests the write scope and verifies the account through whoami', async () => {
    const { adapter, requests } = adapterWith([
      json({
        access_token: 'a',
        refresh_token: 'r',
        expires_in: 86400,
        created_at: 1_800_000_000,
        scope: 'user_rates',
      }),
      json({ id: 7, nickname: 'owner' }),
    ]);
    const url = new URL(adapter.authorizationUrl('state-1'));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client',
      redirect_uri: CONFIG.callbackUrl,
      response_type: 'code',
      scope: 'user_rates',
      state: 'state-1',
    });

    const result = await adapter.authorize('code-1');
    expect(result.account).toEqual({ accountId: '7', accountName: 'owner' });
    expect(result.credentials.expiresAt).toBe(
      new Date((1_800_000_000 + 86400) * 1000).toISOString(),
    );
    const form = new URLSearchParams(requests[0]!.body!);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('redirect_uri')).toBe(CONFIG.callbackUrl);
    expect(requests[1]!.headers.get('authorization')).toBe('Bearer a');
    expect(requests[1]!.headers.get('user-agent')).toBe('Filecab test');
  });

  test('rejects a token without the write scope', async () => {
    const { adapter } = adapterWith([json({ access_token: 'a', scope: 'basic' })]);
    const error = await adapter.authorize('code').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ListSyncAuthorizationError);
    expect((error as ListSyncAuthorizationError).refreshable).toBe(false);
  });

  test('a rejected refresh token needs new consent', async () => {
    const { adapter } = adapterWith([json({ error: 'invalid_grant' }, 400)]);
    const error = await adapter.refresh(CREDENTIALS).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ListSyncAuthorizationError);
    expect((error as ListSyncAuthorizationError).refreshable).toBe(false);
  });
});

describe('Shikimori list reads', () => {
  test('projects statuses, keeps provider values and drops private text', async () => {
    const { adapter, requests } = adapterWith([
      json([
        listRate(1, 'rewatching'),
        listRate(2, 'on_hold'),
        listRate(3, 'completed', { score: 0 }),
        listRate(4, 'planned', { anime: null, manga: { id: 9 } }),
        listRate(5, 'planned', { user: { id: 8 } }),
      ]),
    ]);
    const scan = await adapter.readList(CREDENTIALS, ACCOUNT);
    expect(scan.complete).toBe(true);
    expect(scan.records.map((record) => record.recordId)).toEqual(['1', '2', '3']);
    const [rewatching, onHold, completed] = scan.records;
    expect(rewatching).toMatchObject({
      reference: { namespace: 'shikimori', entity: 'anime', id: '1001' },
      title: 'Звезда',
      titles: [
        { text: 'Звезда', language: 'ru' },
        { text: 'Hoshi', language: 'en' },
      ],
      year: 2024,
      episodeCount: 12,
      posterUrl: 'https://shikimori.io/system/animes/original/1.jpg',
      values: { status: Status.Process, rating: 7, progress: 3 },
      metadata: { rateId: 1, remoteStatus: 'rewatching', rewatches: 1, targetId: 1001 },
    });
    expect(onHold!.values.status).toBeNull();
    expect(onHold!.metadata.remoteStatus).toBe('on_hold');
    expect(completed!.values.rating).toBe(0);
    expect(JSON.stringify(scan.records)).not.toContain('private note');

    const url = requests[0]!.url;
    expect(url.pathname).toBe('/api/users/7/anime_rates');
    // All statuses and censored titles are part of a complete read.
    expect(url.searchParams.has('status')).toBe(false);
    expect(url.searchParams.has('censored')).toBe(false);
  });

  test('reads every page and removes duplicates', async () => {
    const full = Array.from({ length: 5000 }, (_, index) => listRate(index + 1, 'planned'));
    const { adapter, requests } = adapterWith([
      json(full),
      json([listRate(5000, 'completed', { updated_at: '2026-03-01' }), listRate(6000, 'planned')]),
    ]);
    const scan = await adapter.readList(CREDENTIALS, ACCOUNT);
    expect(scan.complete).toBe(true);
    expect(scan.records).toHaveLength(5001);
    expect(scan.records.find((record) => record.recordId === '5000')!.values.status).toBe(
      Status.Complete,
    );
    expect(requests.map((request) => request.url.searchParams.get('page'))).toEqual(['1', '2']);
  });

  test('a restricted list or ignored paging is not a complete read', async () => {
    const restricted = adapterWith([json({}, 403)]);
    expect(await restricted.adapter.readList(CREDENTIALS, ACCOUNT)).toEqual({
      complete: false,
      records: [],
    });

    const full = Array.from({ length: 5000 }, (_, index) => listRate(index + 1, 'planned'));
    const looping = adapterWith([json(full), json(full)]);
    expect((await looping.adapter.readList(CREDENTIALS, ACCOUNT)).complete).toBe(false);
  });

  test('a missing rate is null and a rate of another owner is an error', async () => {
    const missing = adapterWith([json({}, 404)]);
    expect(await missing.adapter.readRecord(CREDENTIALS, ACCOUNT, '50')).toBeNull();

    const foreign = adapterWith([json(userRate({ user_id: 8 }))]);
    await expect(foreign.adapter.readRecord(CREDENTIALS, ACCOUNT, '50')).rejects.toBeInstanceOf(
      ListSyncProviderError,
    );

    const manga = adapterWith([json(userRate({ target_type: 'Manga' }))]);
    await expect(manga.adapter.readRecord(CREDENTIALS, ACCOUNT, '50')).rejects.toBeInstanceOf(
      ListSyncProviderError,
    );
  });
});

describe('Shikimori list writes', () => {
  test('update sends only the given fields and keeps explicit zeros', async () => {
    const { adapter, requests } = adapterWith([json(userRate())]);
    const record = await adapter.updateRecord(CREDENTIALS, ACCOUNT, RECORD, {
      rating: 0,
      progress: 0,
    });
    expect(requests[0]!.method).toBe('PATCH');
    expect(requests[0]!.url.pathname).toBe('/api/v2/user_rates/50');
    // Status, text and rewatches stay on the remote record.
    expect(JSON.parse(requests[0]!.body!)).toEqual({ user_rate: { score: 0, episodes: 0 } });
    expect(record.values).toEqual({ status: Status.Process, rating: 0, progress: 0 });
  });

  test('create posts an anime rate for the verified account', async () => {
    const { adapter, requests } = adapterWith([json(userRate({ status: 'planned' }), 201)]);
    await adapter.createRecord(
      CREDENTIALS,
      ACCOUNT,
      { namespace: 'shikimori', entity: 'anime', id: '1001' },
      { status: Status.Planned, rating: 6, progress: 2 },
    );
    expect(requests[0]!.method).toBe('POST');
    expect(JSON.parse(requests[0]!.body!)).toEqual({
      user_rate: {
        user_id: 7,
        target_id: 1001,
        target_type: 'Anime',
        status: 'planned',
        score: 6,
        episodes: 2,
      },
    });
  });

  test('unsupported values never reach the provider', async () => {
    const { adapter, requests } = adapterWith([]);

    for (const values of [{ status: Status.Hide }, { rating: 7.5 }, { progress: -1 }])
      await expect(
        adapter.updateRecord(CREDENTIALS, ACCOUNT, RECORD, values),
      ).rejects.toBeInstanceOf(ListSyncUnsupportedValueError);

    await expect(
      adapter.createRecord(
        CREDENTIALS,
        ACCOUNT,
        { namespace: 'myanimelist', entity: 'anime', id: '1001' },
        { status: Status.Planned },
      ),
    ).rejects.toBeInstanceOf(ListSyncUnsupportedValueError);
    expect(requests).toHaveLength(0);
  });

  test('a provider validation error is an unsupported value', async () => {
    const { adapter } = adapterWith([json({ errors: ['invalid'] }, 422)]);
    await expect(
      adapter.updateRecord(CREDENTIALS, ACCOUNT, RECORD, { progress: 999 }),
    ).rejects.toBeInstanceOf(ListSyncUnsupportedValueError);
  });

  test('an uncertain write is not repeated inside the call', async () => {
    const { adapter, requests } = adapterWith([new Error('socket closed')]);
    const error = await adapter
      .updateRecord(CREDENTIALS, ACCOUNT, RECORD, { rating: 5 })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ListSyncProviderError);
    expect((error as ListSyncProviderError).retryable).toBe(true);
    expect(requests).toHaveLength(1);
  });
});

describe('Shikimori failures and limits', () => {
  test('a throttled request waits for Retry-After and passes the shared gate again', async () => {
    const { adapter, requests, gated } = adapterWith([
      json({}, 429, { 'retry-after': '0' }),
      json(userRate()),
    ]);
    await adapter.updateRecord(CREDENTIALS, ACCOUNT, RECORD, { rating: 5 });
    expect(requests).toHaveLength(2);
    expect(gated()).toBe(2);
  });

  test('a long Retry-After goes back to the job queue', async () => {
    const { adapter } = adapterWith([json({}, 429, { 'retry-after': '120' })]);
    const error = await adapter
      .readRecord(CREDENTIALS, ACCOUNT, '50')
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ retryable: true, retryAfterMs: 120_000 });
  });

  test('401 can be refreshed; a missing scope cannot', async () => {
    const expired = adapterWith([json({ error: 'invalid_token' }, 401)]);
    const first = await expired.adapter
      .readRecord(CREDENTIALS, ACCOUNT, '50')
      .catch((caught: unknown) => caught);
    expect(first).toBeInstanceOf(ListSyncAuthorizationError);
    expect((first as ListSyncAuthorizationError).refreshable).toBe(true);

    const scope = adapterWith([
      json({}, 403, { 'www-authenticate': 'Bearer error="insufficient_scope"' }),
    ]);
    const second = await scope.adapter
      .updateRecord(CREDENTIALS, ACCOUNT, RECORD, { rating: 5 })
      .catch((caught: unknown) => caught);
    expect(second).toBeInstanceOf(ListSyncAuthorizationError);
    expect((second as ListSyncAuthorizationError).refreshable).toBe(false);
  });
});
