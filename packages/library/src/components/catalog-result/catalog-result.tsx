import { useEffect, useRef } from 'react';
import { Status, titleFor, type EntryPatch } from '@filecab/contracts';
import { useLocalStore } from '../../hooks/use-local-store';
import { LibraryCard } from '../library-card/library-card';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../../hooks/use-workspace';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { catalogResultState, useCatalogSelect } from '../../hooks/use-catalog-select';
import type { CatalogResultProps } from './model-catalog-result';

/** Shows catalog metadata and separate private saved state without treating titles as identity. */
export function CatalogResult({ record }: CatalogResultProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, open, draft, reconciling, remove } = useWorkspace();
  const [{ busy, error }, setters] = useLocalStore(() => ({ busy: false, error: '' }));
  const locked = useRef(false);
  const creationId = useRef(crypto.randomUUID());
  const { saved, conflict } = catalogResultState(state.rows, record);
  const savedId = saved?.entry.entryId;
  const select = useCatalogSelect();
  const blocked = conflict || Boolean(draft) || !state.repository || busy;

  useEffect(() => {
    // Keep the creation ID for retries until the saved entry is visible.
    if (savedId === creationId.current) creationId.current = crypto.randomUUID();
  }, [savedId]);

  const save = async (fields: EntryPatch) => {
    if (locked.current || blocked || !state.repository) return;

    locked.current = true;
    setters.busy(true);
    setters.error('');
    try {
      await state.repository.save(
        saved?.entry.entryId ?? creationId.current,
        record.category,
        fields,
        saved,
        saved ? undefined : record,
      );
    } catch {
      setters.error(t('catalogSaveFailed'));
      void state.repository.refresh().catch(() => {});
    } finally {
      locked.current = false;
      setters.busy(false);
    }
  };
  const primaryAction = {
    label: t(reconciling ? 'catalogAssociate' : 'addTitle'),
    disabled: blocked,
    onClick: () => {
      if (reconciling) {
        open(
          record.category,
          reconciling,
          record,
          saved?.entry.entryId !== reconciling.entry.entryId ? saved : undefined,
        );
      } else {
        void save({
          userTitle: titleFor(record.snapshot, locale, t('Untitled')).text,
          status: Status.Planned,
          rating: 0,
          progress: 0,
          comment: '',
          sourceUrls: [],
        });
      }
    },
  };

  return (
    <LibraryCard
      entry={saved?.entry}
      snapshot={record.snapshot}
      showProviderRating={!saved}
      edit={!reconciling && !blocked ? () => select(record) : undefined}
      remove={saved && !blocked ? () => void remove(saved) : undefined}
      primaryAction={!saved || reconciling ? primaryAction : undefined}
      alert={conflict ? t('catalogIdentityConflict') : error || undefined}
    />
  );
}
