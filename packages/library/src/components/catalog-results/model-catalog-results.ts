import type { TitleColumn } from '../title-results/model-title-results';
import type { CatalogRecord } from '@filecab/contracts';

/** Supplies records and the selected catalog layout. */
export interface CatalogResultsProps {
  columns?: TitleColumn[];
  records: CatalogRecord[];
  view: 'cards' | 'list';
  /** Shows the cards without personal controls, edit or delete. */
  readOnly?: boolean;
}
