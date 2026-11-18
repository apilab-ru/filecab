import type { LocalLibraryRepository } from '../../repository';
import type { LocalSnapshot } from '../../models/local-snapshot';

export interface DeviceSyncState {
  repository: LocalLibraryRepository;
  snapshot: LocalSnapshot;
}

/** Controls whether this hidden sync surface also publishes workspace state. */
export interface DeviceSyncProps {
  registerWorkspace?: boolean;
}
