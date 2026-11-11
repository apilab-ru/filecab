import type { LocalEntry } from '../database';

/** Describes one consistent local library state, including retained tombstones. */
export interface LocalSnapshot {
  revision: number;
  updatedAt: number;
  rows: LocalEntry[];
}
