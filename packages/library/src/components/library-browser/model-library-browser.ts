import type { Category, Entry } from '@filecab/contracts';
import { LibrarySort } from '../../models/library-sort';

export interface LibraryBrowserProps {
  category: Category;
  entries: Entry[];
  available?: boolean;
  onAdd?: () => void;
  onEdit?: (entry: Entry) => void;
  onDelete?: (entry: Entry) => void;
}

export const PAGE_SIZE = 8;

export const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const SORT_ORDER_LABELS = {
  [LibrarySort.Updated]: { ascending: 'oldestFirst', descending: 'newestFirst' },
  [LibrarySort.Title]: { ascending: 'ascending', descending: 'descending' },
  [LibrarySort.Rating]: { ascending: 'lowestFirst', descending: 'highestFirst' },
  [LibrarySort.Year]: { ascending: 'oldestFirst', descending: 'newestFirst' },
} as const;
