import type { Entry } from '@filecab/contracts';

/** Supplies saved state or catalog metadata to the shared title card. */
export interface LibraryCardProps {
  entry?: Entry;
  snapshot?: Entry['snapshot'];
  actions?: CardAction[];
  primaryAction?: CardAction;
  showProviderRating?: boolean;
  alert?: string;
  edit?: () => void;
  remove?: () => void;
}

/** Defines a card menu action for saved entries or catalog results. */
export interface CardAction {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}
