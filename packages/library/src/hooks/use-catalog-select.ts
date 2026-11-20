import { useCallback } from 'react';
import type { CatalogRecord } from '@filecab/contracts';
import { savedCatalogMatch } from '../domain/catalog-selection';
import type { WorkspaceRow } from '../models/workspace';
import { useWorkspace } from './use-workspace';

/** Describes how a catalog result relates to the owner library. */
export interface CatalogResultState {
  saved: WorkspaceRow | undefined;
  conflict: boolean;
}

/** Finds the saved entry of a result and reports identity or category conflicts. */
export function catalogResultState(
  rows: WorkspaceRow[],
  record: CatalogRecord,
): CatalogResultState {
  const match = savedCatalogMatch(rows, record);
  const saved =
    match.kind === 'match' ? rows.find(({ entry }) => entry.entryId === match.entryId) : undefined;

  return {
    saved,
    conflict: match.kind === 'conflict' || (match.kind === 'match' && match.categoryConflict),
  };
}

/**
 * Opens the editor for a selected result: the saved entry when one exists, otherwise an
 * unsaved draft. A conflict, an open draft or a missing repository blocks the selection.
 */
export function useCatalogSelect() {
  const { state, draft, open } = useWorkspace();

  return useCallback(
    (record: CatalogRecord): boolean => {
      const { saved, conflict } = catalogResultState(state.rows, record);

      if (conflict || draft || !state.repository) return false;

      if (saved) open(record.category, saved);
      else open(record.category, undefined, record);

      return true;
    },
    [state.rows, state.repository, draft, open],
  );
}
