import type { CatalogMatchStatus, CatalogMatchTarget } from '@filecab/contracts';

/**
 * Finds catalog data for entries without a catalog item on the server. Only signed-in
 * accounts have it. Each provider has its own job. Without `entries`, the jobs take all
 * entries without catalog data.
 */
export interface CatalogMatchRepository {
  status(ownerId: string): Promise<CatalogMatchStatus>;
  start(ownerId: string, entries?: CatalogMatchTarget[]): Promise<CatalogMatchStatus>;
  stop(ownerId: string): Promise<CatalogMatchStatus>;
}

/** Reports that another request started a catalog data job at the same time. */
export class CatalogMatchBusyError extends Error {
  constructor() {
    super('A catalog data job is starting');
    this.name = 'CatalogMatchBusyError';
  }
}
