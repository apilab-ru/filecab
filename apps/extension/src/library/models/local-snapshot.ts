import type { LocalEntry } from '../database';

/** Describes one consistent local library state, including retained tombstones. */
export interface LocalSnapshot {
  scope: string;
  revision: number;
  updatedAt: number;
  rows: LocalEntry[];
}
