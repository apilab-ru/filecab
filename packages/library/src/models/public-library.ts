import type { SyncDiagnostic } from '@filecab/contracts';

/** Reads and saves the public library username of the current account. */
export interface PublicLibraryRepository {
  read(ownerId: string): Promise<string | null>;
  /** Saves the username. An empty string turns public access off. Returns the saved value. */
  save(username: string, ownerId: string): Promise<string | null>;
  /** Returns the website address of a public library. */
  address(username: string): string;
}

/** Carries safe details about a failed username read. */
export class UsernameReadError extends Error {
  constructor(
    readonly diagnostic: Partial<Pick<SyncDiagnostic, 'code' | 'status' | 'correlationId'>>,
  ) {
    super('Could not read username');
    this.name = 'UsernameReadError';
  }
}

/** Reports that another account uses the username. */
export class UsernameTakenError extends Error {
  constructor() {
    super('The username is taken');
    this.name = 'UsernameTakenError';
  }
}

/** Reports that the server rejected the username format. */
export class UsernameInvalidError extends Error {
  constructor() {
    super('The username is not valid');
    this.name = 'UsernameInvalidError';
  }
}
