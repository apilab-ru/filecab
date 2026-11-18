import { Category } from '@filecab/contracts';
import type { MessageKey } from '../../models/message-key';

/** Supplies the route category for one catalog screen. */
export interface CatalogPageProps {
  category: Category;
}

export const FORMATS: Record<Category, string[]> = {
  [Category.Anime]: ['tv', 'movie', 'ova', 'ona', 'special', 'music'],
  [Category.Films]: ['movie', 'cartoon'],
  [Category.Tv]: ['tv-series', 'animated-series'],
};

export const CATALOG_COLUMNS = [
  { key: 'title', label: 'Title' },
  { key: 'year', label: 'year' },
  { key: 'status', label: 'Status' },
  { key: 'episodes', label: 'episodes' },
  { key: 'rating', label: 'Rating' },
] as const satisfies readonly { key: string; label: MessageKey }[];
