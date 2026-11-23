import { createListSyncRepository, ListSyncRequestError } from '@filecab/library';
import { browser } from 'wxt/browser';
import { listSyncRequest, SyncError } from '../library/sync-transport';

/** Sends list requests through the worker. Consent opens in a new tab and returns to the website. */
export const listSyncRepository = createListSyncRepository(
  async (ownerId, operation, provider, body) => {
    try {
      return await listSyncRequest(ownerId, operation, provider, body);
    } catch (error) {
      if (error instanceof SyncError) throw new ListSyncRequestError(error.diagnostic.status);

      throw error;
    }
  },
  (url) => void browser.tabs.create({ url }),
);
