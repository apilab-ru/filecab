import type { LibraryOrder, LibrarySort } from '../../models/library-sort';

export interface LibraryBrowserPaginationProps {
  total: number;
  start: number;
  current: number;
  pages: number;
  sort: LibrarySort;
  order: LibraryOrder;
  onSortChange: (value: LibrarySort) => void;
  onOrderChange: (value: LibraryOrder) => void;
  onPageChange: (value: number) => void;
}
