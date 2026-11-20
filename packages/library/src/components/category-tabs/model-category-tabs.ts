import type { Category } from '@filecab/contracts';

/** Selects one category in the popup. An empty value marks that no category is chosen yet. */
export interface CategoryTabsProps {
  value: Category | '';
  onChange: (category: Category) => void;
}
