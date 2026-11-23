import { LIST_SYNC_ROUTES, listSyncPath } from '@filecab/contracts';
import { createListSyncRepository, ListSyncRequestError } from '@filecab/library';
import { fetchOwnerRequest } from './session';

/** Sends list requests with the website session. Consent opens in the same tab. */
export const listSyncRepository = createListSyncRepository(
  async (ownerId, operation, provider, body) => {
    const route = LIST_SYNC_ROUTES.get(operation);
    const path = route && listSyncPath(route, provider);

    if (!route || !path) throw new ListSyncRequestError();

    const response = await fetchOwnerRequest(ownerId, `/${path}`, route.method, body);

    if (!response.ok) throw new ListSyncRequestError(response.status);

    return response.json();
  },
  (url) => location.assign(url),
);
