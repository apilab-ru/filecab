import { SyncOperation } from '../models/sync-operation';

/** Describes one owner route of external list connections. `:provider` is a path parameter. */
export interface ListSyncRoute {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
}

/** Maps list operations to API routes. The extension worker allows only these routes. */
export const LIST_SYNC_ROUTES: ReadonlyMap<SyncOperation, ListSyncRoute> = new Map([
  [SyncOperation.ListSyncOverview, { method: 'GET', path: 'list-sync' }],
  [SyncOperation.ListSyncAuthorize, { method: 'POST', path: 'list-sync/:provider/authorize' }],
  [SyncOperation.ListSyncPause, { method: 'POST', path: 'list-sync/:provider/pause' }],
  [SyncOperation.ListSyncResume, { method: 'POST', path: 'list-sync/:provider/resume' }],
  [SyncOperation.ListSyncDisconnect, { method: 'DELETE', path: 'list-sync/:provider' }],
  [SyncOperation.ListSyncExport, { method: 'POST', path: 'list-sync/:provider/export' }],
  [SyncOperation.ListSyncImport, { method: 'POST', path: 'list-sync/:provider/import' }],
  [SyncOperation.ListSyncPreview, { method: 'GET', path: 'list-sync/:provider/import/preview' }],
  [SyncOperation.ListSyncApply, { method: 'POST', path: 'list-sync/:provider/import/apply' }],
  [
    SyncOperation.ListSyncCancelPreview,
    { method: 'DELETE', path: 'list-sync/:provider/import/preview' },
  ],
]);

/** Provider keys are short lowercase identifiers. */
const PROVIDER_KEY = /^[a-z][a-z0-9-]{0,31}$/;

/** Builds the API path of a list route. Returns null for an invalid provider key. */
export function listSyncPath(route: ListSyncRoute, provider: string | undefined): string | null {
  if (!route.path.includes(':provider')) return route.path;

  if (!provider || !PROVIDER_KEY.test(provider)) return null;

  return route.path.replace(':provider', provider);
}
