import { ApiErrorCode, SyncOperation, type AccountUsername } from '@filecab/contracts';
import {
  UsernameInvalidError,
  UsernameReadError,
  UsernameTakenError,
  type PublicLibraryRepository,
} from '@filecab/library';
import { accountRequest, SyncError } from '../library/sync-transport';
import { WEBSITE_ORIGIN } from './connection';

export const publicLibraryRepository: PublicLibraryRepository = {
  async read(ownerId) {
    try {
      const account = await accountRequest<AccountUsername>(ownerId, SyncOperation.ReadUsername);

      return account.username;
    } catch (error) {
      if (error instanceof SyncError) throw new UsernameReadError(error.diagnostic);

      throw error;
    }
  },
  async save(username, ownerId) {
    try {
      const account = await accountRequest<AccountUsername>(ownerId, SyncOperation.SaveUsername, {
        username,
      });

      return account.username;
    } catch (error) {
      if (error instanceof SyncError && error.code === ApiErrorCode.Conflict)
        throw new UsernameTakenError();

      if (error instanceof SyncError && error.code === ApiErrorCode.ValidationError)
        throw new UsernameInvalidError();

      throw error;
    }
  },
  address: (username) => `${WEBSITE_ORIGIN}/u/${encodeURIComponent(username)}`,
};
