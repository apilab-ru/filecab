import { ListSyncField, type ListSyncImportPreview } from '@filecab/contracts';
import type { MessageKey } from '../../models/message-key';

/** Supplies an import preview and the actions that apply or cancel it. */
export interface ListSyncPreviewProps {
  preview: ListSyncImportPreview;
  busy: boolean;
  onApply: (additions: string[], changes: Map<string, Set<ListSyncField>>) => void;
  onCancel: () => void;
}

/** Labels the transferable fields. */
export const FIELD_LABELS = {
  [ListSyncField.Status]: 'listSyncFieldStatus',
  [ListSyncField.Rating]: 'listSyncFieldRating',
  [ListSyncField.Progress]: 'listSyncFieldProgress',
} as const satisfies Record<ListSyncField, MessageKey>;
