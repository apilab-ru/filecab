import {
  SyncOperation,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncOverview,
  type ListSyncAuthorization,
} from '@filecab/contracts';
import type { ListSyncRepository, ListSyncSend } from '../models/list-sync';

/** Builds a list repository from a platform request function and a way to open consent. */
export function createListSyncRepository(
  send: ListSyncSend,
  open: (url: string) => void,
): ListSyncRepository {
  const overview = (operation: SyncOperation) => (provider: string, ownerId: string) =>
    send(ownerId, operation, provider) as Promise<ListSyncOverview>;
  const job = (operation: SyncOperation) => (provider: string, ownerId: string) =>
    send(ownerId, operation, provider) as Promise<ListSyncJob>;

  return {
    overview: (ownerId) =>
      send(ownerId, SyncOperation.ListSyncOverview) as Promise<ListSyncOverview>,
    async connect(provider, ownerId) {
      const authorization = (await send(
        ownerId,
        SyncOperation.ListSyncAuthorize,
        provider,
      )) as ListSyncAuthorization;
      open(authorization.authorizationUrl);
    },
    pause: overview(SyncOperation.ListSyncPause),
    resume: overview(SyncOperation.ListSyncResume),
    disconnect: overview(SyncOperation.ListSyncDisconnect),
    exportList: job(SyncOperation.ListSyncExport),
    importList: job(SyncOperation.ListSyncImport),
    preview: (provider, ownerId) =>
      send(ownerId, SyncOperation.ListSyncPreview, provider) as Promise<ListSyncImportPreview>,
    apply: (provider, ownerId, selection) =>
      send(ownerId, SyncOperation.ListSyncApply, provider, selection) as Promise<ListSyncJob>,
    cancelPreview: overview(SyncOperation.ListSyncCancelPreview),
  };
}
