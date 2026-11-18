import type { LocalEntry } from '../database';

/** Stores a confirmed local merge before either entry is changed so restart can finish it. */
export interface LocalMergeJournal {
  id: string;
  rows: LocalEntry[];
}
