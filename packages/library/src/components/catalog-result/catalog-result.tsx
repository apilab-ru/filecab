import { useRef } from 'react';
import { Status, titleFor, type EntryPatch } from '@filecab/contracts';
import { useLocalStore } from '../../hooks/use-local-store';
import { LibraryCard } from '../library-card/library-card';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../../hooks/use-workspace';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { manualCandidates, savedCatalogMatch } from '../../domain/catalog-selection';
import type { CatalogResultProps } from './model-catalog-result';

/** Shows catalog metadata and separate private saved state without treating titles as identity. */
export function CatalogResult({ record }: CatalogResultProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, open, draft, reconciling } = useWorkspace();
  const [{ busy, error }, setters] = useLocalStore(() => ({ busy: false, error: '' }));
  const locked = useRef(false);
  const creationId = useRef(crypto.randomUUID());
  const match = savedCatalogMatch(state.rows, record);
  const saved =
    match.kind === 'match'
      ? state.rows.find(({ entry }) => entry.entryId === match.entryId)
      : undefined;
  const conflict = match.kind === 'conflict' || (match.kind === 'match' && match.categoryConflict);
  const candidates = manualCandidates(state.rows, record, locale);
  const blocked = conflict || Boolean(draft) || !state.repository || busy;
  let action: 'Edit' | 'addTitle' | 'catalogAssociate' = saved ? 'Edit' : 'addTitle';

  if (reconciling) action = 'catalogAssociate';

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
    label: t(action),
    disabled: blocked,
    onClick: () => {
      if (reconciling) {
        open(
          record.category,
          reconciling,
          record,
          saved?.entry.entryId !== reconciling.entry.entryId ? saved : undefined,
        );
      } else if (saved) {
        open(record.category, saved);
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
      primaryAction={!saved && !reconciling ? primaryAction : undefined}
      alert={conflict ? t('catalogIdentityConflict') : error || undefined}
      actions={[
        ...(saved || reconciling ? [primaryAction] : []),
        ...(!reconciling
          ? candidates.map((candidate) => ({
              label: t('catalogUseManual', { title: candidate.entry.userTitle }),
              disabled: blocked,
              onClick: () => open(record.category, candidate, record, saved),
            }))
          : []),
      ]}
    />
  );
}
