// Bundled only into the test build, never imported by a product entrypoint.
export { LocalLibraryRepository } from '../../../apps/extension/src/library/repository';
export { exportRawLibrary } from '../../../apps/extension/src/library/recovery';
export {
  Category,
  Status,
  Locale,
  ApiErrorCode,
  SyncErrorCode,
} from '../../../packages/contracts/src/index';

export { startLibraryReplication } from '../../../apps/extension/src/library/replication';
export {
  previewLink,
  confirmLink,
  reconcileReset,
} from '../../../apps/extension/src/library/sync-session';
export { SyncError } from '../../../apps/extension/src/library/sync-transport';
export { readCollection } from '../../../apps/extension/src/library/database';
