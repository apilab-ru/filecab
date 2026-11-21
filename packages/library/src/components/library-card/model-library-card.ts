import type { Entry } from '@filecab/contracts';

/** Supplies saved state or catalog metadata to the shared title card. */
export interface LibraryCardProps {
  entry?: Entry;
  snapshot?: Entry['snapshot'];
  primaryAction?: CardAction;
  showProviderRating?: boolean;
  alert?: string;
  edit?: () => void;
  remove?: () => void;
  onGenre?: (genreId: string) => void;
}

/** Defines the main action on a catalog result. */
export interface CardAction {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}
