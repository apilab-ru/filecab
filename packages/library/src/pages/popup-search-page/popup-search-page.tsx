import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Category, type CatalogSearchRequest, type Locale } from '@filecab/contracts';
import { Button } from '@filecab/ui';
import { CatalogMessages } from '../../components/catalog-messages/catalog-messages';
import { CompactResult } from '../../components/compact-result/compact-result';
import { useCatalogSearch } from '../../hooks/use-catalog-search';
import { useCatalogSelect } from '../../hooks/use-catalog-select';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useOnline } from '../../hooks/use-online';
import { useWorkspace } from '../../hooks/use-workspace';
import { POPUP_PAGE_SIZE } from './model-popup-search-page';
import './popup-search-page.scss';

/** Searches the catalog by category and title in the popup and opens the editor for a result. */
export function PopupSearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { category } = useParams();
  const { origin } = useWorkspace();
  const { locale } = useInterfacePreferences();
  const online = useOnline();
  const select = useCatalogSelect();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const autoSelected = useRef('');
  const valid = Object.values(Category).includes(category as Category);
  const request: CatalogSearchRequest = {
    category: valid ? (category as Category) : Category.Anime,
    query,
    locale: locale as Locale,
    page,
    pageSize: POPUP_PAGE_SIZE,
  };
  const search = useCatalogSearch(origin, request, retry);
  const queryKey = JSON.stringify([request.category, query.trim(), locale]);
  const results = search.result?.results ?? [];

  // A new category, title or locale starts again from the first page.
  useEffect(() => setPage(1), [queryKey]);

  // A single result for a typed title opens the editor one time for each query.
  // Closing the editor returns to the results.
  useEffect(() => {
    if (!query.trim() || page !== 1 || results.length !== 1 || autoSelected.current === queryKey)
      return;

    if (select(results[0]!)) autoSelected.current = queryKey;
  }, [search.result, page, queryKey, select]);

  if (!valid) return <Navigate replace to="/search/anime" />;

  return (
    <section className="popup-search" aria-label={t('search')}>
      <div className="popup-search__controls">
        <label className="popup-search__field">
          {t('Category')}
          <select
            className="popup-search__input"
            value={request.category}
            onChange={(event) => navigate(`/search/${event.target.value}`)}
          >
            {Object.values(Category).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="popup-search__field">
          {t('popupSearchQuery')}
          <input
            className="popup-search__input"
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <CatalogMessages
        search={search}
        online={online}
        onRetry={() => setRetry((value) => value + 1)}
      />
      {search.loading && online && (
        <p className="popup-search__loading" role="status">
          {t('catalogLoading')}
        </p>
      )}
      {results.length > 0 && (
        <ul className="popup-search__results" aria-label={t('popupSearchResults')}>
          {results.map((record) => (
            <CompactResult key={record.catalogId} record={record} />
          ))}
        </ul>
      )}
      {(page > 1 || search.result?.hasMore) && (
        <nav className="popup-search__pages" aria-label={t('popupSearchResults')}>
          <Button
            disabled={search.loading || page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {t('previousPage')}
          </Button>
          <span className="popup-search__page">{t('catalogPageNumber', { page })}</span>
          <Button
            disabled={search.loading || !search.result?.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('nextPage')}
          </Button>
        </nav>
      )}
    </section>
  );
}
