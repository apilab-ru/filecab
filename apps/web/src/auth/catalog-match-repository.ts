import type { CatalogMatchStatus } from '@filecab/contracts';
import { CatalogMatchBusyError, type CatalogMatchRepository } from '@filecab/library';
import { fetchOwnerRequest } from './session';

/** Sends one catalog data request and maps a running job to `CatalogMatchBusyError`. */
async function send(
  ownerId: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<CatalogMatchStatus> {
  const response = await fetchOwnerRequest(ownerId, `/library/catalog-match${path}`, method, body);

  if (response.status === 409) throw new CatalogMatchBusyError();

  if (!response.ok) throw new Error('Catalog data request failed');

  return (await response.json()) as CatalogMatchStatus;
}

export const catalogMatchRepository: CatalogMatchRepository = {
  status: (ownerId) => send(ownerId, '', 'GET'),
  start: (ownerId, entries) => send(ownerId, '', 'POST', entries ? { entries } : {}),
  stop: (ownerId) => send(ownerId, '/stop', 'POST', {}),
};
