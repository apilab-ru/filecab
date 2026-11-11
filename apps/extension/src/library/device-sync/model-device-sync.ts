import type { LocalLibraryRepository } from '../repository';
import type { LocalSnapshot } from '../models/local-snapshot';

export interface DeviceSyncState {
  repository: LocalLibraryRepository;
  snapshot: LocalSnapshot;
}
