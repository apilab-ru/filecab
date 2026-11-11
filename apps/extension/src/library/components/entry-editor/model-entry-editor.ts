import type { Category, EntryPatch } from '@filecab/contracts';
import type { LocalEntry } from '../../database';

export interface EntryEditorProps {
  category: Category;
  row: LocalEntry | null;
  save: (category: Category, fields: EntryPatch) => Promise<void>;
  cancel: () => void;
  reload?: () => Promise<void>;
}
