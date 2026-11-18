import type { ReactNode } from 'react';
import type { LibraryLayout } from '../../models/library-layout';
import { SortDirection } from '../../models/sort-direction';

/** Configures the shared title collection layout. */
export interface TitleResultsProps {
  layout: LibraryLayout;
  children: ReactNode;
  columns?: TitleColumn[];
}

/** Describes one list column and the ordering supported by its data source. */
export interface TitleColumn {
  key: string;
  label: string;
  direction?: SortDirection;
  directions?: SortDirection[];
  onSort?: (direction: SortDirection) => void;
}

export const OPPOSITE_DIRECTION = {
  [SortDirection.Asc]: SortDirection.Desc,
  [SortDirection.Desc]: SortDirection.Asc,
};

export const SORT_ARROWS = {
  [SortDirection.Asc]: '▴',
  [SortDirection.Desc]: '▾',
};

export const SORT_TITLE_KEYS = {
  [SortDirection.Asc]: 'sortColumnAscending',
  [SortDirection.Desc]: 'sortColumnDescending',
} as const;
