import { ApiErrorCode, type AccountUsername, type ApiError } from '@filecab/contracts';
import {
  UsernameInvalidError,
  UsernameReadError,
  UsernameTakenError,
  type PublicLibraryRepository,
} from '@filecab/library';
import { fetchOwnerRequest } from './session';

export const publicLibraryRepository: PublicLibraryRepository = {
  async read(ownerId) {
    const response = await fetchOwnerRequest(ownerId, '/account/username', 'GET');

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as ApiError | null;
      const correlationId = response.headers.get('X-Correlation-ID');

      throw new UsernameReadError({
        code: data?.code && Object.values(ApiErrorCode).includes(data.code) ? data.code : undefined,
        status: response.status,
        correlationId:
          correlationId && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(correlationId)
            ? correlationId
            : undefined,
      });
    }

    const account = (await response.json()) as AccountUsername;

    return account.username;
  },
  async save(username, ownerId) {
    const response = await fetchOwnerRequest(ownerId, '/account/username', 'PUT', { username });

    if (response.status === 409) throw new UsernameTakenError();

    if (response.status === 400) throw new UsernameInvalidError();

    if (!response.ok) throw new Error('Could not save username');

    const account = (await response.json()) as AccountUsername;

    return account.username;
  },
  address: (username) => `${location.origin}/u/${encodeURIComponent(username)}`,
};
