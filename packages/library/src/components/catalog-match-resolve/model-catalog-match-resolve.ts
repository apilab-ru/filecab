import type { WorkspaceRow } from '../../models/workspace';

/** Supplies the entry to link and closes the dialog. */
export interface CatalogMatchResolveProps {
  row: WorkspaceRow;
  onClose(): void;
}

/** The dialog shows at most this many catalog results. */
export const RESOLVE_PAGE_SIZE = 12;
