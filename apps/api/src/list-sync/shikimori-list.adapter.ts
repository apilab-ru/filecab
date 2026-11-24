import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Category, ListSyncField, Status, type ListSyncValues } from '@filecab/contracts';
import {
  ListSyncAuthorizationError,
  ListSyncProviderError,
  ListSyncUnsupportedValueError,
  type ListSyncAccount,
  type ListSyncAdapter,
  type ListSyncCredentials,
  type ListSyncReference,
  type RemoteListRecord,
  type RemoteListScan,
} from './list-sync-adapter';
import type { RequestGate } from './provider-rate-limiter';
import {
  ShikimoriAnimeRateDto,
  ShikimoriTokenDto,
  ShikimoriUserDto,
  ShikimoriUserRateDto,
} from './shikimori-list.dto';

/** Configures the registered Shikimori application. */
export interface ShikimoriConfig {
  origin: string;
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  userAgent: string;
}

/** The scope that permits list writes. */
const WRITE_SCOPE = 'user_rates';

/** The documented maximum page size of the anime list. */
const PAGE_LIMIT = 5000;

/** A list with more pages than this is not read completely. */
const MAX_PAGES = 20;

/** An access token lives one day when the response does not give its lifetime. */
const DEFAULT_TOKEN_LIFETIME_S = 24 * 60 * 60;

/** A request that takes longer stops. */
const TIMEOUT_MS = 20_000;

/** A response larger than this is rejected. */
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

/** A 429 response is retried at most this many times inside one call. */
const MAX_RATE_RETRIES = 3;

/** A Retry-After value above this goes back to the job queue. */
const MAX_INLINE_RETRY_MS = 30_000;

/** A failed safe read is retried at most this many times inside one call. */
const MAX_READ_RETRIES = 2;

/** Maps Filecab statuses to remote statuses. `hide` has no remote status. */
const REMOTE_STATUSES: Readonly<Partial<Record<Status, string>>> = {
  [Status.Planned]: 'planned',
  [Status.Process]: 'watching',
  [Status.Complete]: 'completed',
  [Status.Drop]: 'dropped',
};

/** Projects remote statuses to Filecab. `on_hold` has no Filecab status. */
const LOCAL_STATUSES: Readonly<Record<string, Status | null>> = {
  planned: Status.Planned,
  watching: Status.Process,
  rewatching: Status.Process,
  completed: Status.Complete,
  dropped: Status.Drop,
  on_hold: null,
};

/** Describes one HTTP request to Shikimori. */
interface ShikimoriRequest {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  token?: string;
  json?: unknown;
  form?: Record<string, string>;
}

/** A 404 response. Callers decide whether a missing record is an error. */
class ShikimoriNotFound extends ListSyncProviderError {
  constructor() {
    super(false);
  }
}

/** A 403 response that is an access denial, not a missing scope. Never refreshed. */
class ShikimoriAccessDenied extends ListSyncProviderError {
  constructor() {
    super(false);
  }
}

/** The token endpoint rejected the code, refresh token or client. */
class ShikimoriRejected extends ListSyncProviderError {
  constructor() {
    super(false);
  }
}

/** Validates a response object against its DTO. */
function decode<T extends object>(dto: new () => T, value: unknown): T {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ListSyncProviderError(false);

  const instance = plainToInstance(dto, value);

  if (validateSync(instance, { forbidUnknownValues: true }).length)
    throw new ListSyncProviderError(false);

  return instance;
}

/** Reads the Retry-After header in milliseconds. */
function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after');

  if (!value) return undefined;

  if (/^\d+$/.test(value)) return Number(value) * 1000;

  const at = Date.parse(value);

  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

/** Reads a bounded JSON body. */
async function readJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES)
    throw new ListSyncProviderError(false);

  const text = await response.text();

  if (text.length > MAX_RESPONSE_BYTES) throw new ListSyncProviderError(false);

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new ListSyncProviderError(false);
  }
}

/** Returns true when a 403 response reports a missing OAuth scope. */
async function missingScope(response: Response): Promise<boolean> {
  if (response.headers.get('www-authenticate')?.includes('insufficient_scope')) return true;

  const body = await response.text().catch(() => '');

  return body.includes('insufficient_scope');
}

/** Waits for the given time. */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Validates an absolute score. Shikimori stores integers from 0 to 10, and 0 clears. */
function remoteScore(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10)
    throw new ListSyncUnsupportedValueError();

  return value;
}

/** Validates an absolute episode count. */
function remoteEpisodes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new ListSyncUnsupportedValueError();

  return value;
}

/** Validates a status that Shikimori can store. */
function remoteStatus(value: Status | null): string {
  const status = value === null ? undefined : REMOTE_STATUSES[value];

  if (!status) throw new ListSyncUnsupportedValueError();

  return status;
}

/** Builds the write body. It holds only the given fields, so remote text and rewatches stay. */
function writeFields(values: Partial<ListSyncValues>): Record<string, string | number> {
  const fields: Record<string, string | number> = {};

  if (values.status !== undefined) fields.status = remoteStatus(values.status);

  if (values.rating !== undefined) fields.score = remoteScore(values.rating);

  if (values.progress !== undefined) fields.episodes = remoteEpisodes(values.progress);

  return fields;
}

/** Projects remote list values. An unknown remote status projects to null. */
function projectValues(rate: { status: string; score: number; episodes: number }): ListSyncValues {
  return {
    status: LOCAL_STATUSES[rate.status] ?? null,
    rating: rate.score,
    progress: rate.episodes,
  };
}

/** Keeps provider-only values. Private notes and their HTML are never stored. */
function rateMetadata(rate: {
  id: number;
  status: string;
  rewatches?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}): Record<string, unknown> {
  return {
    rateId: rate.id,
    remoteStatus: rate.status,
    rewatches: rate.rewatches ?? 0,
    createdAt: rate.created_at ?? null,
    updatedAt: rate.updated_at ?? null,
  };
}

/** Reads the year from an `aired_on` date. */
function airedYear(value: string | null | undefined): number | null {
  const year = value ? Number(value.slice(0, 4)) : NaN;

  return Number.isInteger(year) && year > 1800 ? year : null;
}

/**
 * Reads and writes the anime list of one Shikimori account. Only the documented REST
 * operations are used: no PUT, DELETE or increment requests.
 */
export class ShikimoriListAdapter implements ListSyncAdapter {
  readonly provider = 'shikimori';
  readonly name = 'Shikimori';
  readonly categories = [Category.Anime];
  readonly namespace = 'shikimori';
  readonly entity = 'anime';
  readonly fields = [ListSyncField.Status, ListSyncField.Rating, ListSyncField.Progress];
  readonly statuses = [Status.Planned, Status.Process, Status.Complete, Status.Drop];

  private readonly origin: URL;

  constructor(
    private readonly config: ShikimoriConfig,
    private readonly gate: RequestGate,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.origin = new URL(config.origin);
  }

  authorizationUrl(state: string): string {
    const url = new URL('/oauth/authorize', this.origin);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', this.config.callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', WRITE_SCOPE);
    url.searchParams.set('state', state);

    return url.href;
  }

  async authorize(code: string) {
    const credentials = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.callbackUrl,
    });
    const user = decode(
      ShikimoriUserDto,
      await this.send({
        method: 'GET',
        path: '/api/users/whoami',
        token: credentials.accessToken,
      }),
    );

    return { credentials, account: { accountId: String(user.id), accountName: user.nickname } };
  }

  async refresh(credentials: ListSyncCredentials): Promise<ListSyncCredentials> {
    if (!credentials.refreshToken) throw new ListSyncAuthorizationError();

    return this.token({ grant_type: 'refresh_token', refresh_token: credentials.refreshToken });
  }

  async readList(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
  ): Promise<RemoteListScan> {
    const rates = new Map<number, ShikimoriAnimeRateDto>();
    let previous = '';

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      let body: unknown;

      try {
        body = await this.send({
          method: 'GET',
          path: `/api/users/${encodeURIComponent(account.accountId)}/anime_rates?limit=${PAGE_LIMIT}&page=${page}`,
          token: credentials.accessToken,
        });
      } catch (error) {
        // A private or restricted list is not a complete read.
        if (error instanceof ShikimoriAccessDenied) return { complete: false, records: [] };

        throw error;
      }

      if (!Array.isArray(body)) throw new ListSyncProviderError(false);

      const signature = JSON.stringify(body.map((item: { id?: unknown }) => item?.id));

      // Identical pages mean that the provider ignores paging. Stop instead of looping.
      if (page > 1 && signature === previous) return { complete: false, records: [] };

      previous = signature;
      const items = body.slice(0, PAGE_LIMIT).map((item) => decode(ShikimoriAnimeRateDto, item));

      for (const rate of items) {
        if (!rate.anime || (rate.user && String(rate.user.id) !== account.accountId)) continue;

        // Changing pagination can repeat a record. Keep its newest version.
        const known = rates.get(rate.id);

        if (!known || (rate.updated_at ?? '') >= (known.updated_at ?? '')) rates.set(rate.id, rate);
      }

      if (body.length < PAGE_LIMIT) {
        return {
          complete: true,
          records: [...rates.values()].map((rate) => this.listRecord(rate)),
        };
      }
    }

    return { complete: false, records: [] };
  }

  async readRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    recordId: string,
  ): Promise<RemoteListRecord | null> {
    if (!/^\d+$/.test(recordId)) return null;

    try {
      return this.rateRecord(
        account,
        await this.send({
          method: 'GET',
          path: `/api/v2/user_rates/${recordId}`,
          token: credentials.accessToken,
        }),
      );
    } catch (error) {
      if (error instanceof ShikimoriNotFound) return null;

      throw error;
    }
  }

  async createRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    reference: ListSyncReference,
    values: Partial<ListSyncValues>,
  ): Promise<RemoteListRecord> {
    if (
      reference.namespace !== this.namespace ||
      reference.entity !== this.entity ||
      !/^[1-9]\d*$/.test(reference.id) ||
      !/^[1-9]\d*$/.test(account.accountId)
    )
      throw new ListSyncUnsupportedValueError();

    return this.rateRecord(
      account,
      await this.send({
        method: 'POST',
        path: '/api/v2/user_rates',
        token: credentials.accessToken,
        json: {
          user_rate: {
            user_id: Number(account.accountId),
            target_id: Number(reference.id),
            target_type: 'Anime',
            ...writeFields(values),
          },
        },
      }),
    );
  }

  async updateRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    record: RemoteListRecord,
    values: Partial<ListSyncValues>,
  ): Promise<RemoteListRecord> {
    if (!/^\d+$/.test(record.recordId)) throw new ListSyncUnsupportedValueError();

    return this.rateRecord(
      account,
      await this.send({
        method: 'PATCH',
        path: `/api/v2/user_rates/${record.recordId}`,
        token: credentials.accessToken,
        json: { user_rate: writeFields(values) },
      }),
    );
  }

  /** Exchanges a code or refresh token and checks the granted scope. */
  private async token(form: Record<string, string>): Promise<ListSyncCredentials> {
    let body: unknown;

    try {
      body = await this.send({
        method: 'POST',
        path: '/oauth/token',
        form: {
          ...form,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        },
      });
    } catch (error) {
      // An invalid code or refresh token cannot be repaired without new consent.
      if (error instanceof ShikimoriNotFound || error instanceof ShikimoriRejected)
        throw new ListSyncAuthorizationError(false);

      throw error;
    }

    const token = decode(ShikimoriTokenDto, body);
    const scopes = token.scope.split(/\s+/).filter(Boolean);

    if (!scopes.includes(WRITE_SCOPE)) throw new ListSyncAuthorizationError(false);

    const issued = token.created_at ? token.created_at * 1000 : Date.now();
    const lifetime = (token.expires_in ?? DEFAULT_TOKEN_LIFETIME_S) * 1000;

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: new Date(issued + lifetime).toISOString(),
      scopes,
    };
  }

  /** Converts an anime list record. */
  private listRecord(rate: ShikimoriAnimeRateDto): RemoteListRecord {
    const anime = rate.anime!;
    const titles = [
      ...(anime.russian?.trim() ? [{ text: anime.russian.trim(), language: 'ru' }] : []),
      ...(anime.name?.trim() ? [{ text: anime.name.trim(), language: 'en' }] : []),
    ];

    return {
      recordId: String(rate.id),
      reference: { namespace: this.namespace, entity: this.entity, id: String(anime.id) },
      category: Category.Anime,
      title: titles[0]?.text ?? `Shikimori ${anime.id}`,
      titles,
      year: airedYear(anime.aired_on),
      posterUrl: this.poster(anime.image?.original ?? anime.image?.preview ?? null),
      episodeCount: anime.episodes ? anime.episodes : null,
      values: projectValues(rate),
      metadata: { ...rateMetadata(rate), targetId: anime.id },
    };
  }

  /** Converts a user rate and checks its owner and target type. */
  private rateRecord(account: ListSyncAccount, body: unknown): RemoteListRecord {
    const rate = decode(ShikimoriUserRateDto, body);

    if (String(rate.user_id) !== account.accountId || rate.target_type !== 'Anime')
      throw new ListSyncProviderError(false);

    return {
      recordId: String(rate.id),
      reference: { namespace: this.namespace, entity: this.entity, id: String(rate.target_id) },
      category: Category.Anime,
      title: `Shikimori ${rate.target_id}`,
      titles: [],
      year: null,
      posterUrl: null,
      episodeCount: null,
      values: projectValues(rate),
      metadata: { ...rateMetadata(rate), targetId: rate.target_id },
    };
  }

  /** Accepts only provider image paths and HTTPS images on the provider host. */
  private poster(value: string | null): string | null {
    if (!value || value.includes('missing_')) return null;

    try {
      const url = new URL(value, this.origin);

      const host = this.origin.hostname;
      const trusted = url.hostname === host || url.hostname.endsWith(`.${host}`);

      return url.protocol === 'https:' && trusted ? url.href : null;
    } catch {
      return null;
    }
  }

  /**
   * Sends one request through the shared rate limit. A 429 response is retried for all
   * methods because the provider did not process it. Other failures are retried only for
   * reads: an uncertain write goes back to the job, which reads the list again first.
   */
  private async send(request: ShikimoriRequest): Promise<unknown> {
    let rateRetries = 0;
    let readRetries = 0;

    while (true) {
      await this.gate.acquire();

      let response: Response;

      try {
        response = await this.fetch(request);
      } catch {
        if (request.method === 'GET' && readRetries < MAX_READ_RETRIES) {
          readRetries += 1;
          await sleep(500 * 2 ** readRetries);
          continue;
        }

        throw new ListSyncProviderError(true);
      }

      if (response.ok) return readJson(response);

      if (response.status === 429) {
        const delay = retryAfterMs(response) ?? 1000 * 2 ** rateRetries;

        if (rateRetries < MAX_RATE_RETRIES && delay <= MAX_INLINE_RETRY_MS) {
          rateRetries += 1;
          await sleep(delay);
          continue;
        }

        throw new ListSyncProviderError(true, delay);
      }

      if (response.status >= 500) {
        if (request.method === 'GET' && readRetries < MAX_READ_RETRIES) {
          readRetries += 1;
          await sleep(500 * 2 ** readRetries);
          continue;
        }

        throw new ListSyncProviderError(true, retryAfterMs(response));
      }

      if (response.status === 401) {
        // The token endpoint answers 401 for an invalid client or grant.
        if (request.path === '/oauth/token') throw new ShikimoriRejected();

        throw new ListSyncAuthorizationError();
      }

      if (response.status === 403) {
        if (await missingScope(response)) throw new ListSyncAuthorizationError(false);

        throw new ShikimoriAccessDenied();
      }

      if (response.status === 404) throw new ShikimoriNotFound();

      if (response.status === 422) throw new ListSyncUnsupportedValueError();

      if (request.path === '/oauth/token' && response.status === 400) throw new ShikimoriRejected();

      throw new ListSyncProviderError(false);
    }
  }

  private async fetch(request: ShikimoriRequest): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': this.config.userAgent,
    };
    let body: string | undefined;

    if (request.token) headers.Authorization = `Bearer ${request.token}`;

    if (request.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(request.json);
    }

    if (request.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(request.form).toString();
    }

    return this.fetcher(new URL(request.path, this.origin), {
      method: request.method,
      headers,
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }
}
