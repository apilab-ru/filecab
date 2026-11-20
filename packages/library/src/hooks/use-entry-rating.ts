import type { Entry } from '@filecab/contracts';
import { useEntryUpdate } from './use-entry-update';

/** Saves personal ratings with the current owner revision and retains failed values. */
export function useEntryRating(entry?: Entry) {
  const { busy, error, disabled, update } = useEntryUpdate(entry);

  return { busy, error, disabled, setRating: (rating: number) => update({ rating }) };
}
