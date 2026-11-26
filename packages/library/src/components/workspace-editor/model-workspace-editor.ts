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
