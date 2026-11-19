import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { titleFor, type CatalogRecord, type Category } from '@filecab/contracts';
import { useLocalStore } from '../../hooks/use-local-store';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import {
  UNDO_PERIOD,
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspaceDeletion,
  type WorkspaceDraft,
  type WorkspaceRow,
  type WorkspaceState,
} from '../../models/workspace';
import { WorkspaceEditor } from '../../components/workspace-editor/workspace-editor';
import { UndoBar } from '../../components/undo-bar/undo-bar';
import type { WorkspaceProviderProps } from './model-workspace-provider';

const MAX_TOASTS = 3;

/** Keeps catalog drafts and the editor mounted across all library and catalog routes. */
export function WorkspaceProvider({ origin, children }: WorkspaceProviderProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const [{ state, draft, reconciling, deletions, notice }, setters] = useLocalStore(() => ({
    state: { scope: '', rows: [], repository: null } as WorkspaceState,
    draft: null as WorkspaceDraft | null,
    reconciling: null as WorkspaceRow | null,
    deletions: [] as WorkspaceDeletion[],
    notice: '' as WorkspaceContextValue['notice'],
  }));
  const scope = useRef('');
  const register = useCallback((next: WorkspaceState) => {
    if (scope.current && scope.current !== next.scope) {
      setters.draft(null);
      setters.reconciling(null);
      setters.deletions([]);
      setters.notice('');
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
  const { repository } = state;
  const remove = useCallback(
    async (row: WorkspaceRow) => {
      if (!repository) return;

      setters.notice('');
      try {
        const tombstone = await repository.remove(row);
        const title = titleFor(row.entry.snapshot, locale, t('Untitled'), row.entry.userTitle).text;
        setters.notice('');
        setters.deletions((current) =>
          [
            ...current.filter(({ tombstone }) => tombstone.entry.entryId !== row.entry.entryId),
            { tombstone, title, until: Date.now() + UNDO_PERIOD },
          ].slice(-MAX_TOASTS),
        );
      } catch {
        setters.deletions((current) => current.slice(-(MAX_TOASTS - 1)));
        setters.notice('deleteFailed');
        void repository.refresh().catch(() => {});
      }
    },
    [repository, locale, t],
  );
  const undo = useCallback(
    async (deletion: WorkspaceDeletion) => {
      if (!repository) return;

      setters.notice('');
      setters.deletions((current) => current.filter((item) => item !== deletion));
      try {
        await repository.restore(deletion.tombstone);
      } catch {
        setters.deletions((current) => current.slice(-(MAX_TOASTS - 1)));
        setters.notice('undoFailed');
        void repository.refresh().catch(() => {});
      }
    },
    [repository],
  );

  useEffect(() => {
    if (!deletions.length) return;

    const next = Math.min(...deletions.map(({ until }) => until));
    const timer = setTimeout(
      () => setters.deletions((current) => current.filter(({ until }) => until > Date.now())),
      Math.max(0, next - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [deletions]);

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
      deletions,
      notice,
      remove,
      undo,
    }),
    [
      origin,
      state,
      draft,
      reconciling,
      register,
      close,
      rebase,
      open,
      deletions,
      notice,
      remove,
      undo,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
      {draft && <WorkspaceEditor key={draft.id} draft={draft} />}
      <UndoBar />
    </WorkspaceContext.Provider>
  );
}
