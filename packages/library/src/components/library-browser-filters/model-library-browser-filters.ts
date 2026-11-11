import type { Entry } from '@filecab/contracts';
import type { LibraryLayout } from '../../models/library-layout';

export interface LibraryBrowserFiltersProps {
  query: string;
  status: string | null;
  rating: string;
  genre: string;
  genres: Entry['snapshot']['genres'];
  layout: LibraryLayout;
  available: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string | null) => void;
  onRatingChange: (value: string) => void;
  onGenreChange: (value: string) => void;
  onLayoutChange: (value: LibraryLayout) => void;
  onAdd?: () => void;
}
