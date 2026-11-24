import { useMemo, useState } from 'react';
import type { Entry } from '@filecab/contracts';
import { UndoBar } from '../../src/components/undo-bar/undo-bar';
import {
  TOAST_PERIOD,
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspaceRepository,
  type WorkspaceToast,
} from '../../src/models/workspace';
import type { StoryWorkspaceProps } from './model-story-workspace';

/** Pretends to persist entry changes so that card controls react like in the application. */
export function StoryWorkspace({ entries: initial, children }: StoryWorkspaceProps) {
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [toasts, setToasts] = useState<WorkspaceToast[]>([]);
  const value = useMemo<WorkspaceContextValue>(() => {
    const repository: WorkspaceRepository = {
      save: async (entryId, _category, patch) => {
        setEntries((current) =>
          current.map((entry) => (entry.entryId === entryId ? { ...entry, ...patch } : entry)),
        );
      },
      preview: async () => ({ changes: [], confirm: async () => {} }),
      remove: async (row) => row,
      restore: async () => {},
      refresh: async () => {},
    };

    return {
      origin: 'https://filecab.example',
      state: {
        scope: 'storybook',
        rows: entries.map((entry) => ({ entry, version: entry.updatedAt })),
        repository,
      },
      register: () => {},
      draft: null,
      reconciling: null,
      reconcile: () => {},
      open: () => {},
      close: () => {},
      rebase: () => {},
      deletions: [],
      notice: '',
      remove: async () => {},
      undo: async () => {},
      toasts,
      toast: (message, error = false) =>
        setToasts((current) =>
          [
            ...current,
            { id: crypto.randomUUID(), message, error, until: Date.now() + TOAST_PERIOD },
          ].slice(-3),
        ),
      dismissToast: (id) => setToasts((current) => current.filter((item) => item.id !== id)),
    };
  }, [entries, toasts]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children(entries)}
      <UndoBar />
    </WorkspaceContext.Provider>
  );
}
