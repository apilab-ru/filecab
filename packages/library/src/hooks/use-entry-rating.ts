import { useRef } from 'react';
import type { Entry } from '@filecab/contracts';
import { useTranslation } from 'react-i18next';
import { useLocalStore } from './use-local-store';
import { useWorkspace } from './use-workspace';

/** Saves personal ratings with the current owner revision and retains failed values. */
export function useEntryRating(entry?: Entry) {
  const { t } = useTranslation();
  const { state, draft } = useWorkspace();
  const [{ busy, error }, setters] = useLocalStore(() => ({ busy: false, error: '' }));
  const locked = useRef(false);
  const row = state.rows.find((row) => row.entry.entryId === entry?.entryId && !row.entry.deleted);
  const disabled = !row || !state.repository || Boolean(draft);
  const setRating = async (rating: number): Promise<boolean> => {
    if (locked.current || disabled || !row || !state.repository) return false;

    locked.current = true;
    setters.busy(true);
    setters.error('');
    try {
      await state.repository.save(row.entry.entryId, row.entry.category, { rating }, row);

      return true;
    } catch {
      setters.error(t('catalogSaveFailed'));
      void state.repository.refresh().catch(() => {});

      return false;
    } finally {
      locked.current = false;
      setters.busy(false);
    }
  };

  return { busy, error, disabled, setRating };
}
