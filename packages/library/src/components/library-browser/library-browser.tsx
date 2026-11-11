import './library-browser.scss';

import { Icon, IconName } from '@filecab/ui';
import { LibraryCard } from '../library-card/library-card';
import { LibraryBrowserFilters } from '../library-browser-filters/library-browser-filters';
import { LibraryBrowserPagination } from '../library-browser-pagination/library-browser-pagination';
import { useLibraryBrowserDatasource } from './library-browser-datasource';
import type { LibraryBrowserProps } from './model-library-browser';

/** Renders the library browser from its filtered and paginated datasource. */
export function LibraryBrowser({
  category,
  entries,
  onAdd,
  onEdit,
  onDelete,
  available = true,
}: LibraryBrowserProps) {
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
        onAdd={onAdd}
      />
      <div className="library-browser__results">
        {available && displayed.length === 0 && (
          <div className="library-browser__empty">
            <Icon name={IconName.Library} />
            <p>{rows.length ? t('noMatches') : t('emptyLibrary')}</p>
          </div>
        )}
        <ul className={`library-browser__entries library-browser__entries--${layout}`}>
          {displayed.map((entry) => (
            <LibraryCard
              key={entry.entryId}
              entry={entry}
              edit={onEdit ? () => onEdit(entry) : undefined}
              remove={onDelete ? () => onDelete(entry) : undefined}
            />
          ))}
        </ul>
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
