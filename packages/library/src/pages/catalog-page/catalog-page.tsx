import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogSkeleton } from '../../components/catalog-skeleton/catalog-skeleton';
import { BrowserFilters } from '../../components/browser-filters/browser-filters';
import type { BrowserFilter } from '../../components/browser-filters/model-browser-filters';
import { CatalogResults } from '../../components/catalog-results/catalog-results';
import type { TitleColumn } from '../../components/title-results/model-title-results';
import { CatalogMessages } from '../../components/catalog-messages/catalog-messages';
import { CatalogPagination } from '../../components/catalog-pagination/catalog-pagination';
import { LibraryLayout } from '../../models/library-layout';
import { useWorkspace } from '../../hooks/use-workspace';
import { useCatalogSearch } from '../../hooks/use-catalog-search';
import {
  CATALOG_FILTER_FIELDS,
  CATALOG_PAGE_SIZE,
  useCatalogRoute,
} from '../../hooks/use-catalog-route';
import { useOnline } from '../../hooks/use-online';
import { allowedCatalogOptions } from '../../domain/catalog-order';
import { SORT_DIRECTIONS } from '../../models/sort-direction';
import { CATALOG_COLUMNS, FORMATS, type CatalogPageProps } from './model-catalog-page';
import './catalog-page.scss';

/** Runs capability-aware catalog search while keeping the shared editor and owner library separate. */
export function CatalogPage({ category }: CatalogPageProps) {
  const { t } = useTranslation();
  const { origin } = useWorkspace();
  const route = useCatalogRoute(category);
  const online = useOnline();
  const [retry, setRetry] = useState(0);
  const search = useCatalogSearch(origin, route.request, retry);
  const allowed = allowedCatalogOptions(search.capability, route.query);
  const total = search.result?.total;
  const lastPage =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));

  const filters = CATALOG_FILTER_FIELDS.filter((key) =>
    search.capability?.filters.includes(key),
  ).map((key): BrowserFilter => {
    const label = t(`catalogFilter_${key}`, { defaultValue: key });
    const options = [
      { value: '', label },
      ...FORMATS[category].map((value) => ({ value, label: value })),
    ];

    return {
      key,
      label,
      value: route.value(key),
      disabled: !allowed.filters.includes(key),
      onChange: (value) => route.update(key, value ?? ''),
      options: key === 'year' ? undefined : options,
    };
  });

  const columns = CATALOG_COLUMNS.map(({ key, label }): TitleColumn => ({
    key,
    label: t(label),
    directions: SORT_DIRECTIONS.filter((direction) =>
      allowed.orders.includes(`${key}-${direction}`),
    ),
    direction: SORT_DIRECTIONS.find((direction) => route.order === `${key}-${direction}`),
    onSort: (direction) => route.update('order', `${key}-${direction}`),
  }));

  return (
    <section className="catalog-page" aria-label={t('catalog')}>
      <BrowserFilters
        query={route.query}
        queryLabel={t('catalogQuery')}
        onQueryChange={(value) => route.update('q', value)}
        filters={filters}
      />
      <CatalogMessages
        search={search}
        online={online}
        onRetry={() => setRetry((current) => current + 1)}
      />
      {search.result && (
        <CatalogResults records={search.result.results} view={route.view} columns={columns} />
      )}
      {search.loading && online && (
        <CatalogSkeleton layout={route.view === 'list' ? LibraryLayout.List : LibraryLayout.Grid} />
      )}
      {!search.result && (!search.loading || !online) && <div className="title-results-region" />}
      <CatalogPagination
        page={route.page}
        lastPage={lastPage}
        hasMore={Boolean(search.result?.hasMore)}
        loading={search.loading}
        hasResult={Boolean(search.result)}
        sortable={Boolean(search.capability?.ordering.length)}
        orders={allowed.orders}
        order={route.order}
        onOrderChange={(value) => route.update('order', value)}
        onPageChange={(value) => route.update('page', String(value))}
      />
    </section>
  );
}
