import type { Category } from '@filecab/contracts';

/** Selects the public library and the route category to show. */
export interface PublicLibraryProps {
  username: string;
  category: Category;
}
