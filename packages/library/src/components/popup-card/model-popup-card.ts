import type { CatalogRecord } from '@filecab/contracts';
import type { WorkspaceRow } from '../../models/workspace';

/** Supplies a catalog result, a saved entry or both to one popup card. */
export interface PopupCardProps {
  record?: CatalogRecord;
  row?: WorkspaceRow;
  /** The page URL that a Page tab save adds. The card marks the entry that holds it. */
  link?: string;
  /** Called before a click links the page or opens the editor. */
  onPick?: () => void;
}
