import type { PublicLibraryRepository } from '../../models/public-library';

/** Identifies the short result message of the last username action. */
export type PublicLibraryNotice =
  | ''
  | 'publicLibraryOn'
  | 'publicLibraryOff'
  | 'usernameTaken'
  | 'usernameInvalid'
  | 'publicLibrarySaveFailed';

/** Notices that report a failure and use the alert role. */
export const PUBLIC_LIBRARY_ERRORS = new Set<PublicLibraryNotice>([
  'usernameTaken',
  'usernameInvalid',
  'publicLibrarySaveFailed',
]);

/** Supplies the account and repository for its public library username. */
export interface PublicLibrarySettingsProps {
  ownerId: string;
  repository: PublicLibraryRepository;
}
