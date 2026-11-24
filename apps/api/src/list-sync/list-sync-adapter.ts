import type { Category, ListSyncField, ListSyncValues, Status } from '@filecab/contracts';

/** Identifies a title in the provider namespace that the adapter writes. */
export interface ListSyncReference {
  namespace: string;
  entity: string;
  id: string;
}

/** Holds provider credentials. They exist only on the server, encrypted at rest. */
export interface ListSyncCredentials {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string[];
}

/** Identifies a remote account that the adapter verified through the authorized API. */
export interface ListSyncAccount {
  accountId: string;
  accountName: string;
}

/** Describes one record of the remote list with values projected to Filecab terms. */
export interface RemoteListRecord {
  recordId: string;
  reference: ListSyncReference;
  category: Category;
  /** A display title for previews and reports. */
  title: string;
  /** Titles with their languages for the snapshot of an imported entry. */
  titles: Array<{ text: string; language: string }>;
  year: number | null;
  posterUrl: string | null;
  episodeCount: number | null;
  /** Projected values. A status that Filecab cannot represent is null. */
  values: ListSyncValues;
  /** Provider-only values, for example the original remote status. */
  metadata: Record<string, unknown>;
}

/** Returns a remote list read. Only a complete read can drive export or import. */
export interface RemoteListScan {
  complete: boolean;
  records: RemoteListRecord[];
}

/** Connects Filecab to one personal-list provider. Provider HTTP DTOs stay inside the adapter. */
export interface ListSyncAdapter {
  readonly provider: string;
  readonly name: string;
  /** Library categories that the provider list contains. */
  readonly categories: Category[];
  /** The reference namespace and entity that identify a title for this provider. */
  readonly namespace: string;
  readonly entity: string;
  readonly fields: ListSyncField[];
  /** Filecab statuses that the provider can store. `hide` is never exported. */
  readonly statuses: Status[];
  authorizationUrl(state: string): string;
  /** Exchanges the consent code and verifies the account through the authorized API. */
  authorize(code: string): Promise<{ credentials: ListSyncCredentials; account: ListSyncAccount }>;
  refresh(credentials: ListSyncCredentials): Promise<ListSyncCredentials>;
  /** Revokes upstream tokens when the provider supports it. */
  revoke?(credentials: ListSyncCredentials): Promise<void>;
  readList(credentials: ListSyncCredentials, account: ListSyncAccount): Promise<RemoteListScan>;
  readRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    recordId: string,
  ): Promise<RemoteListRecord | null>;
  createRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    reference: ListSyncReference,
    values: Partial<ListSyncValues>,
  ): Promise<RemoteListRecord>;
  /** Writes only the given fields. Absolute values only, never increments. */
  updateRecord(
    credentials: ListSyncCredentials,
    account: ListSyncAccount,
    record: RemoteListRecord,
    values: Partial<ListSyncValues>,
  ): Promise<RemoteListRecord>;
}

/**
 * Reports invalid or expired provider authorization. A refresh can repair only an invalid or
 * expired token. A missing scope or an access denial is not refreshable.
 */
export class ListSyncAuthorizationError extends Error {
  constructor(readonly refreshable = true) {
    super('Provider authorization is invalid');
    this.name = 'ListSyncAuthorizationError';
  }
}

/** Reports a provider failure. A retryable failure requeues the job. */
export class ListSyncProviderError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super('Provider request failed');
    this.name = 'ListSyncProviderError';
  }
}

/** Reports a value of one item that the provider cannot store. */
export class ListSyncUnsupportedValueError extends Error {
  constructor() {
    super('The provider cannot store this value');
    this.name = 'ListSyncUnsupportedValueError';
  }
}

/** Builds a stable map key for a provider reference. */
export function referenceKey(reference: ListSyncReference): string {
  return JSON.stringify([reference.namespace, reference.entity, reference.id]);
}
