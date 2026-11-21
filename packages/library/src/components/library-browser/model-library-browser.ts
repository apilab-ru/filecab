import type { Category, Entry } from '@filecab/contracts';
import { LibrarySort } from '../../models/library-sort';

/** Selects the category that the shared library browser shows from the active workspace. */
export interface LibraryBrowserProps {
  category: Category;
}

/** Supplies the saved entries that the browser filters, sorts and paginates. */
export interface LibraryBrowserDatasourceInput {
  category: Category;
  entries: Entry[];
}

export const PAGE_SIZE = 8;

export const RATING_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const SORT_ORDER_LABELS = {
  [LibrarySort.Added]: { ascending: 'oldestFirst', descending: 'newestFirst' },
  [LibrarySort.Updated]: { ascending: 'oldestFirst', descending: 'newestFirst' },
  [LibrarySort.Title]: { ascending: 'ascending', descending: 'descending' },
  [LibrarySort.Rating]: { ascending: 'lowestFirst', descending: 'highestFirst' },
  [LibrarySort.Status]: { ascending: 'ascending', descending: 'descending' },
  [LibrarySort.Episodes]: { ascending: 'lowestFirst', descending: 'highestFirst' },
  [LibrarySort.Year]: { ascending: 'oldestFirst', descending: 'newestFirst' },
} as const;
