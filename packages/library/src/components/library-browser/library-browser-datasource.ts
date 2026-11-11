import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import { Status, titleFor } from '@filecab/contracts';
import { useLocalStore } from '../../hooks/use-local-store';
import { LibraryLayout } from '../../models/library-layout';
import { LibraryOrder, LibrarySort } from '../../models/library-sort';
import type { LibraryBrowserProps } from './model-library-browser';
import { PAGE_SIZE } from './model-library-browser';

/** Owns browser filters and derives the visible, sorted and paginated entries. */
export function useLibraryBrowserDatasource({ entries, category }: LibraryBrowserProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const [
    { query, status, rating, genre, sort, order, layout, page },
    {
      query: setQuery,
      status: setStatus,
      rating: setRating,
      genre: setGenre,
      sort: setSort,
      order: setOrder,
      layout: setLayout,
      page: setPage,
    },
  ] = useLocalStore(() => ({
    query: '',
    status: null as string | null,
    rating: '',
    genre: '',
    sort: LibrarySort.Updated,
    order: LibraryOrder.Descending,
    layout: LibraryLayout.Grid,
    page: 1,
  }));

  const rows = entries.filter((entry) => !entry.deleted && entry.category === category);
  const visible = rows.filter((entry) => status === Status.Hide || entry.status !== Status.Hide);
  const genres = [
    ...new Map(
      rows.flatMap((entry) => entry.snapshot.genres).map((item) => [item.genreId, item]),
    ).values(),
  ];
  const matches = visible.filter((entry) => {
    const texts = [
      entry.userTitle,
      entry.comment,
      entry.snapshot.originalTitle?.text ?? '',
      ...entry.snapshot.titles.map((title) => title.text),
    ];

    return (
      (!status || entry.status === status) &&
      (!rating || entry.rating >= Number(rating)) &&
      (!genre || entry.snapshot.genres.some((item) => item.genreId === genre)) &&
      (!query ||
        texts.some((text) =>
          text.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)),
        ))
    );
  });
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  matches.sort((a, b) => {
    let result = 0;

    if (sort === LibrarySort.Title)
      result = collator.compare(
        titleFor(a.snapshot, locale, '', a.userTitle).text,
        titleFor(b.snapshot, locale, '', b.userTitle).text,
      );
    else if (sort === LibrarySort.Rating) result = a.rating - b.rating;
    else if (sort === LibrarySort.Year)
      result = (a.snapshot.year ?? -Infinity) - (b.snapshot.year ?? -Infinity);
    else result = a.updatedAt.localeCompare(b.updatedAt);

    return (
      result * (order === LibraryOrder.Ascending ? 1 : -1) || a.entryId.localeCompare(b.entryId)
    );
  });

  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE_SIZE;
  const displayed = matches.slice(start, start + PAGE_SIZE);

  const changeFilter = (action: () => void) => {
    action();
    setPage(1);
  };

  return {
    current,
    displayed,
    genre,
    genres,
    layout,
    matches,
    order,
    pages,
    query,
    rating,
    rows,
    setGenre: (value: string) => changeFilter(() => setGenre(value)),
    setLayout,
    setOrder: (value: LibraryOrder) => changeFilter(() => setOrder(value)),
    setPage,
    setQuery: (value: string) => changeFilter(() => setQuery(value)),
    setRating: (value: string) => changeFilter(() => setRating(value)),
    setSort: (value: LibrarySort) => changeFilter(() => setSort(value)),
    setStatus: (value: string | null) => changeFilter(() => setStatus(value)),
    sort,
    start,
    status,
    t,
  };
}
