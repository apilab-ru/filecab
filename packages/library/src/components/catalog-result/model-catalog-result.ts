import type { CatalogRecord } from '@filecab/contracts';

/** Supplies one normalized catalog record to an identity-aware result card. */
export interface CatalogResultProps {
  record: CatalogRecord;
}
