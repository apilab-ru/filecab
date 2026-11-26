import './catalog-match-resolve.scss';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Icon, IconName } from '@filecab/ui';
import { catalogMatchTitle } from '@filecab/contracts';
import { useCatalogSearch } from '../../hooks/use-catalog-search';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useOnline } from '../../hooks/use-online';
import { useWorkspace } from '../../hooks/use-workspace';
import { CatalogMessages } from '../catalog-messages/catalog-messages';
import { CatalogResults } from '../catalog-results/catalog-results';
import { CatalogSkeleton } from '../catalog-skeleton/catalog-skeleton';
import { LibraryLayout } from '../../models/library-layout';
import { RESOLVE_PAGE_SIZE, type CatalogMatchResolveProps } from './model-catalog-match-resolve';

/**
 * Lets the owner link an entry that the catalog data job could not link. The dialog searches
 * the catalog for the entry title. Link opens the shared editor, where Save links it.
 */
export function CatalogMatchResolve({ row, onClose }: CatalogMatchResolveProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { origin, draft, reconciling, reconcile, remove, state } = useWorkspace();
  const online = useOnline();
  const [query, setQuery] = useState(() => catalogMatchTitle(row.entry));
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const search = useCatalogSearch(
    origin,
    {
      category: row.entry.category,
      query: query.trim().slice(0, 200),
      locale,
      page: 1,
      pageSize: RESOLVE_PAGE_SIZE,
    },
    retry,
  );

  // Catalog cards offer Link while the workspace matches this entry.
  useEffect(() => {
    reconcile(row);

    return () => reconcile(null);
  }, []);

  // Link opens the editor and Cancel ends the matching. Both close the dialog.
  useEffect(() => {
    if (reconciling?.entry.entryId === row.entry.entryId) started.current = true;
    else if (started.current) onClose();
  }, [reconciling]);

  useEffect(() => {
    if (draft) onClose();
  }, [draft]);

  // Deletes the entry with the usual Undo. A failure shows the workspace notice.
  const deleteEntry = async () => {
    setDeleting(true);
    await remove(row);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      wide
      className="catalog-match-resolve-dialog"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('catalogMatchResolveTitle')}
      description={t('catalogMatchResolveDescription', { title: catalogMatchTitle(row.entry) })}
      headerActions={
        <>
          <div className="catalog-match-resolve__search">
            <Icon name={IconName.Search} />
            <input
              ref={searchInput}
              className="catalog-match-resolve__query"
              type="search"
              aria-label={t('catalogQuery')}
              placeholder={t('catalogQuery')}
              value={query}
              maxLength={200}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <Button
                type="button"
                className="catalog-match-resolve__clear"
                aria-label={t('catalogMatchResolveClear')}
                onClick={() => {
                  setQuery('');
                  searchInput.current?.focus();
                }}
              >
                <span aria-hidden="true">×</span>
              </Button>
            )}
          </div>
          <div className="catalog-match-resolve__actions">
            <Button
              type="button"
              className="catalog-match-resolve__delete"
              aria-label={t('catalogMatchResolveDelete')}
              title={t('catalogMatchResolveDelete')}
              disabled={deleting || !state.repository}
              onClick={() => void deleteEntry()}
            >
              <Icon name={IconName.Trash} />
            </Button>
            <Button
              type="button"
              className="catalog-match-resolve__close"
              aria-label={t('catalogMatchResolveClose')}
              title={t('catalogMatchResolveClose')}
              disabled={deleting}
              onClick={onClose}
            >
              <span aria-hidden="true">×</span>
            </Button>
          </div>
        </>
      }
    >
      <div className="catalog-match-resolve">
        <CatalogMessages
          search={search}
          online={online}
          hideMatching
          onRetry={() => setRetry((value) => value + 1)}
        />
        {search.result && <CatalogResults records={search.result.results} view="cards" readOnly />}
        {search.loading && online && <CatalogSkeleton layout={LibraryLayout.Grid} />}
      </div>
    </ConfirmDialog>
  );
}
