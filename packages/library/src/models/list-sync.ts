import type {
  ListSyncImportApply,
  ListSyncImportPreview,
  ListSyncJob,
  ListSyncOverview,
  SyncOperation,
} from '@filecab/contracts';

/** Exports, imports and manages the external list connections of the current account. */
export interface ListSyncRepository {
  overview(ownerId: string): Promise<ListSyncOverview>;
  /** Opens provider consent. The provider returns to the website Settings page. */
  connect(provider: string, ownerId: string): Promise<void>;
  pause(provider: string, ownerId: string): Promise<ListSyncOverview>;
  resume(provider: string, ownerId: string): Promise<ListSyncOverview>;
  disconnect(provider: string, ownerId: string): Promise<ListSyncOverview>;
  exportList(provider: string, ownerId: string): Promise<ListSyncJob>;
  importList(provider: string, ownerId: string): Promise<ListSyncJob>;
  preview(provider: string, ownerId: string): Promise<ListSyncImportPreview>;
  apply(provider: string, ownerId: string, selection: ListSyncImportApply): Promise<ListSyncJob>;
  cancelPreview(provider: string, ownerId: string): Promise<ListSyncOverview>;
}

/** Sends one allowlisted list operation for the account and returns the response body. */
export type ListSyncSend = (
  ownerId: string,
  operation: SyncOperation,
  provider?: string,
  body?: unknown,
) => Promise<unknown>;

/** Reports a failed list request with its HTTP status when one is known. */
export class ListSyncRequestError extends Error {
  constructor(readonly status?: number) {
    super('List request failed');
    this.name = 'ListSyncRequestError';
  }
}
