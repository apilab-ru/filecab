import type { Entry } from '@filecab/contracts';

export interface LibraryCardProps {
  entry: Entry;
  edit?: () => void;
  remove?: () => void;
}
