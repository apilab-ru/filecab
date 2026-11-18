import { useCallback, useMemo, useRef } from 'react';
import { useLocalStore } from '../../hooks/use-local-store';
import {
  WorkspaceContext,
  type WorkspaceDraft,
  type WorkspaceRow,
  type WorkspaceState,
} from '../../models/workspace';
import type { CatalogRecord, Category } from '@filecab/contracts';
import { WorkspaceEditor } from '../../components/workspace-editor/workspace-editor';
import type { WorkspaceProviderProps } from './model-workspace-provider';

/** Keeps catalog drafts and the editor mounted across all library and catalog routes. */
export function WorkspaceProvider({ origin, children }: WorkspaceProviderProps) {
  const [{ state, draft, reconciling }, setters] = useLocalStore(() => ({
    state: { scope: '', rows: [], repository: null } as WorkspaceState,
    draft: null as WorkspaceDraft | null,
    reconciling: null as WorkspaceRow | null,
  }));
  const scope = useRef('');
  const register = useCallback((next: WorkspaceState) => {
    if (scope.current && scope.current !== next.scope) {
      setters.draft(null);
      setters.reconciling(null);
    }

    scope.current = next.scope;
    setters.state(next);
  }, []);
  const close = useCallback(
    (id?: string) => setters.draft((current) => (!id || current?.id === id ? null : current)),
    [],
  );
  const rebase = useCallback(
    () =>
      setters.draft((current) => {
        if (!current?.row) return current;

        const row = state.rows.find((row) => row.entry.entryId === current.row!.entry.entryId);
        const other = current.other
          ? state.rows.find((row) => row.entry.entryId === current.other!.entry.entryId)
          : undefined;

        return row ? { ...current, row, other } : current;
      }),
    [state.rows],
  );
  const open = useCallback(
    (category: Category, row?: WorkspaceRow, catalog?: CatalogRecord, other?: WorkspaceRow) => {
      setters.draft(
        (current) => current ?? { id: crypto.randomUUID(), category, row, catalog, other },
      );
      setters.reconciling(null);
    },
    [],
  );
  const value = useMemo(
    () => ({
      origin,
      state,
      draft,
      reconciling,
      register,
      close,
      rebase,
      open,
      reconcile: setters.reconciling,
    }),
    [origin, state, draft, reconciling, register, close, rebase, open],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {draft && <WorkspaceEditor key={draft.id} draft={draft} />}
    </WorkspaceContext.Provider>
  );
}
