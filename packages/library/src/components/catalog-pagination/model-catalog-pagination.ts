import type { MessageKey } from '../../models/message-key';
import { SortDirection } from '../../models/sort-direction';

/** Configures catalog ordering and page navigation. */
export interface CatalogPaginationProps {
  page: number;
  lastPage?: number;
  hasMore: boolean;
  loading: boolean;
  hasResult: boolean;
  sortable: boolean;
  orders: string[];
  order?: string;
  onOrderChange: (value: string) => void;
  onPageChange: (value: number) => void;
}

export const SORT_FIELD_LABELS = {
  year: 'year',
  rating: 'catalogFilter_providerRating',
  title: 'Title',
} as const satisfies Record<string, MessageKey>;

export const DIRECTION_LABELS = {
  year: { [SortDirection.Asc]: 'oldestFirst', [SortDirection.Desc]: 'newestFirst' },
  title: { [SortDirection.Asc]: 'ascending', [SortDirection.Desc]: 'descending' },
} as const satisfies Record<string, Record<SortDirection, MessageKey>>;

export const DEFAULT_DIRECTION_LABELS = {
  [SortDirection.Asc]: 'lowestFirst',
  [SortDirection.Desc]: 'highestFirst',
} as const satisfies Record<SortDirection, MessageKey>;
