import { ApiErrorCode, SyncOperation, type CatalogMatchStatus } from '@filecab/contracts';
import { CatalogMatchBusyError, type CatalogMatchRepository } from '@filecab/library';
import { accountRequest, SyncError } from '../library/sync-transport';

/** Sends one catalog data request through the worker. */
async function send(
  ownerId: string,
  operation:
    | SyncOperation.CatalogMatchStatus
    | SyncOperation.CatalogMatchStart
    | SyncOperation.CatalogMatchStop,
  body?: unknown,
): Promise<CatalogMatchStatus> {
  try {
    return await accountRequest<CatalogMatchStatus>(ownerId, operation, body);
  } catch (error) {
    if (error instanceof SyncError && error.code === ApiErrorCode.Conflict)
      throw new CatalogMatchBusyError();

    throw error;
  }
}

export const catalogMatchRepository: CatalogMatchRepository = {
  status: (ownerId) => send(ownerId, SyncOperation.CatalogMatchStatus),
  start: (ownerId, entries) =>
    send(ownerId, SyncOperation.CatalogMatchStart, entries ? { entries } : {}),
  stop: (ownerId) => send(ownerId, SyncOperation.CatalogMatchStop, {}),
};
