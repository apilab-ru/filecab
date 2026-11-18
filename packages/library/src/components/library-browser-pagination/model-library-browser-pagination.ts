import { LibrarySort } from '../../models/library-sort';
import type { SortDirection } from '../../models/sort-direction';
import type { MessageKey } from '../../models/message-key';

export interface LibraryBrowserPaginationProps {
  total: number;
  start: number;
  current: number;
  pages: number;
  sort: LibrarySort;
  order: SortDirection;
  onSortChange: (value: LibrarySort) => void;
  onOrderChange: (value: SortDirection) => void;
  onPageChange: (value: number) => void;
}

export const SORT_FIELDS = [
  { value: LibrarySort.Updated, label: 'recentlyUpdated' },
  { value: LibrarySort.Title, label: 'Title' },
  { value: LibrarySort.Rating, label: 'Rating' },
  { value: LibrarySort.Year, label: 'year' },
  { value: LibrarySort.Status, label: 'Status' },
  { value: LibrarySort.Episodes, label: 'episodes' },
] as const satisfies readonly { value: LibrarySort; label: MessageKey }[];
