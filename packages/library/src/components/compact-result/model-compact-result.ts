import type { CatalogRecord } from '@filecab/contracts';

/** Supplies one catalog result to the compact popup list. */
export interface CompactResultProps {
  record: CatalogRecord;
  /** The page URL that a popup Page tab save adds. */
  link?: string;
}
