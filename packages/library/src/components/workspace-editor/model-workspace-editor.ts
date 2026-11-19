import type { WorkspaceDraft } from '../../models/workspace';

/** Supplies one stable unsaved draft to the shared editor. */
export interface WorkspaceEditorProps {
  draft: WorkspaceDraft;
}

export const MERGE_FIELD_LABELS = {
  userTitle: 'Title',
  status: 'Status',
  rating: 'Rating',
  progress: 'Progress',
  comment: 'Comment',
} as const;

export const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
