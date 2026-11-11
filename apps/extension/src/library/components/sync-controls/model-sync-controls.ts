import { ApiErrorCode, SyncErrorCode } from '@filecab/contracts';
import type { LocalLibraryRepository } from '../../repository';
import type { LocalSnapshot } from '../../models/local-snapshot';

export interface SyncControlsProps {
  repository: LocalLibraryRepository;
  snapshot: LocalSnapshot;
}

export const SYNC_MESSAGES: Partial<Record<ApiErrorCode | SyncErrorCode, string>> = {
  [SyncErrorCode.PreviewChanged]:
    'One of the libraries changed. Preview the link again before confirming.',
  [SyncErrorCode.AccountChanged]:
    'Synchronization is paused. Sign in to the account linked to this device library.',
  [ApiErrorCode.ValidationError]:
    'The server rejected a document. Your local data is preserved; retry after correcting it.',
  [SyncErrorCode.NetworkError]:
    'The API could not be reached. Check its address and connection; saved changes will be retried.',
  [SyncErrorCode.WorkerUnavailable]:
    'The extension worker did not reply. Reload the extension and reopen this page.',
  [ApiErrorCode.Forbidden]:
    'The API denied synchronization. Check this extension origin in EXTENSION_ORIGINS and restart the API.',
  [SyncErrorCode.ApiOutdated]:
    'The API has no replication route. Restart the API with the current implementation.',
  [ApiErrorCode.InvalidResponse]:
    'The API returned an unreadable response. Check the API address and server logs.',
  [ApiErrorCode.PayloadTooLarge]:
    'The synchronization batch exceeds the API body limit. Your saved changes are preserved.',
  [ApiErrorCode.RateLimited]:
    'The API is rate limiting synchronization. Saved changes will be retried.',
  [SyncErrorCode.ServerError]:
    'The API failed to synchronize. Use the request ID below to check its logs.',
  [ApiErrorCode.ServiceUnavailable]:
    'The API is unavailable. Check database readiness; saved changes will be retried.',
  [SyncErrorCode.ReplicationError]:
    'Local replication failed. Saved data is preserved; check the diagnostic code below.',
  [SyncErrorCode.RequestFailed]: 'Synchronization failed. Saved local changes will be retried.',
};

export const SYNC_PHASE_MESSAGES = {
  idle: 'Account synchronization is up to date.',
  syncing: 'Synchronizing saved changes, or waiting for another open window…',
  'reset-required': 'Synchronizing saved changes, or waiting for another open window…',
};
