import type { Category } from '@filecab/contracts';

/** Supplies the route-selected category to a client library adapter. */
export interface LibraryContentProps {
  category: Category;
}
