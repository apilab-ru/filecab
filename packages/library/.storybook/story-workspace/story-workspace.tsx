import { useMemo, useState } from 'react';
import type { Entry } from '@filecab/contracts';
import {
  WorkspaceContext,
  type WorkspaceContextValue,
  type WorkspaceRepository,
} from '../../src/models/workspace';
import type { StoryWorkspaceProps } from './model-story-workspace';

/** Pretends to persist entry changes so that card controls react like in the application. */
export function StoryWorkspace({ entries: initial, children }: StoryWorkspaceProps) {
  const [entries, setEntries] = useState<Entry[]>(initial);
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
    };
  }, [entries]);

  return <WorkspaceContext.Provider value={value}>{children(entries)}</WorkspaceContext.Provider>;
}
