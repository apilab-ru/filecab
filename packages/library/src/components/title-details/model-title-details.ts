import type { Snapshot, Source } from '@filecab/contracts';

/** Supplies the metadata and personal text that the details overlay shows. */
export interface TitleDetailsProps {
  id: string;
  snapshot: Snapshot;
  comment: string;
  sources: Source[];
  onGenre?: (genreId: string) => void;
  onClose: () => void;
}
