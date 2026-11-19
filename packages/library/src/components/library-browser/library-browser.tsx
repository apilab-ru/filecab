import { LibrarySort } from '../../models/library-sort';
import { SORT_DIRECTIONS } from '../../models/sort-direction';
import { TitleResults } from '../title-results/title-results';
import './library-browser.scss';

import { Icon, IconName } from '@filecab/ui';
import { LibraryCard } from '../library-card/library-card';
import { LibraryBrowserFilters } from '../library-browser-filters/library-browser-filters';
import { LibraryBrowserPagination } from '../library-browser-pagination/library-browser-pagination';
import { useLibraryBrowserDatasource } from './library-browser-datasource';
import { useWorkspace } from '../../hooks/use-workspace';
import type { LibraryBrowserProps } from './model-library-browser';

/** Renders the active workspace library with shared add, edit and delete actions. */
export function LibraryBrowser({ category }: LibraryBrowserProps) {
  const { state, open, remove } = useWorkspace();
  const available = Boolean(state.repository);
  const entries = state.rows.map(({ entry }) => entry);
  const rowFor = (entryId: string) => state.rows.find(({ entry }) => entry.entryId === entryId);
  const {
    current,
    displayed,
    genres,
    genre,
    layout,
    matches,
    order,
    pages,
    query,
    rating,
    rows,
    setGenre,
    setLayout,
    setOrder,
    setPage,
    setQuery,
    setRating,
    setSort,
    setStatus,
    sort,
    start,
    status,
    t,
  } = useLibraryBrowserDatasource({ entries, category });

  return (
    <section className="library-browser" aria-label={t('library')}>
      <LibraryBrowserFilters
        query={query}
        status={status}
        rating={rating}
        genre={genre}
        genres={genres}
        layout={layout}
        available={available}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onRatingChange={setRating}
        onGenreChange={setGenre}
        onLayoutChange={setLayout}
        onAdd={available ? () => open(category) : undefined}
      />
      <div className="title-results-region">
        {available && displayed.length === 0 && (
          <div className="library-browser__empty">
            <Icon name={IconName.Library} />
            <p>{rows.length ? t('noMatches') : t('emptyLibrary')}</p>
          </div>
        )}
        <TitleResults
          layout={layout}
          columns={[
            { key: LibrarySort.Title, label: t('Title') },
            { key: LibrarySort.Year, label: t('year') },
            { key: LibrarySort.Status, label: t('Status') },
            { key: LibrarySort.Episodes, label: t('episodes') },
            { key: LibrarySort.Rating, label: t('Rating') },
          ].map((column) => ({
            ...column,
            direction: sort === column.key ? order : undefined,
            directions: SORT_DIRECTIONS,
            onSort: (direction) => {
              setSort(column.key);
              setOrder(direction);
            },
          }))}
        >
          {displayed.map((entry) => {
            const row = available ? rowFor(entry.entryId) : undefined;

            return (
              <LibraryCard
                key={entry.entryId}
                entry={entry}
                edit={row ? () => open(category, row) : undefined}
                remove={row ? () => void remove(row) : undefined}
                onGenre={setGenre}
              />
            );
          })}
        </TitleResults>
      </div>
      <LibraryBrowserPagination
        total={matches.length}
        start={start}
        current={current}
        pages={pages}
        sort={sort}
        order={order}
        onSortChange={setSort}
        onOrderChange={setOrder}
        onPageChange={setPage}
      />
    </section>
  );
}
