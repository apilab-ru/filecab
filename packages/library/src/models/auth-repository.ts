import type { AccountInfo } from '@filecab/contracts';
import type { CatalogMatchRepository } from './catalog-match';
import type { ListSyncRepository } from './list-sync';
import type { PublicLibraryRepository } from './public-library';

/** Describes safe diagnostic metadata without credentials or raw server errors. */
export interface AuthDiagnostic {
  stage: string;
  code: string;
  status?: number;
  correlationId?: string;
}

/** Supplies a localized label key and public connection value for troubleshooting. */
export interface AuthConnectionDetail {
  label: string;
  value: string;
}

/** Reports authentication failures consistently across application implementations. */
export interface AuthError {
  message: string;
  diagnostic?: AuthDiagnostic;
  connectionDetails?: AuthConnectionDetail[];
}

/** Contains only the account and presentation state needed by authentication controls. */
export interface AuthState {
  account: AccountInfo | null;
  busy: boolean;
  error: AuthError | null;
}

/** Exposes observable authentication state and application-specific session operations. */
export interface AuthRepository {
  readonly publicLibrary: PublicLibraryRepository;
  readonly listSync: ListSyncRepository;
  readonly catalogMatch: CatalogMatchRepository;
  getSnapshot: () => AuthState;
  subscribe: (listener: () => void) => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
}
