import { useInterfacePreferences } from '../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import '../styles/library-browser-shared.scss';
import './library-browser-pagination.scss';

import { Button, Icon, IconName } from '@filecab/ui';
import { LibraryOrder, LibrarySort } from '../models/library-sort';
import { PAGE_SIZE, SORT_ORDER_LABELS } from '../library-browser/model-library-browser';
import type { LibraryBrowserPaginationProps } from './model-library-browser-pagination';

/** Renders result counts, sort controls and page navigation. */
export function LibraryBrowserPagination({
  total,
  start,
  current,
  pages,
  sort,
  order,
  onSortChange,
  onOrderChange,
  onPageChange,
}: LibraryBrowserPaginationProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const pageStart = Math.min(Math.max(current - 3, 1), Math.max(pages - 6, 1));
  const pageNumbers = Array.from({ length: Math.min(pages, 7) }, (_, index) => pageStart + index);
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <div className="library-browser__pagination">
      <span>
        {total
          ? `${numberFormat.format(start + 1)}–${numberFormat.format(Math.min(start + PAGE_SIZE, total))}`
          : '0'}{' '}
        {t('of')} {numberFormat.format(total)}
      </span>
      <label className="library-browser__ordering">
        <span>{t('sortBy')}</span>
        <select
          className="library-browser__select"
          aria-label={t('sortBy')}
          value={sort}
          onChange={(event) => onSortChange(event.target.value as LibrarySort)}
        >
          <option value={LibrarySort.Updated}>{t('recentlyUpdated')}</option>
          <option value={LibrarySort.Title}>{t('Title')}</option>
          <option value={LibrarySort.Rating}>{t('Rating')}</option>
          <option value={LibrarySort.Year}>{t('year')}</option>
        </select>
      </label>
      <label className="library-browser__ordering">
        <span>{t('order')}</span>
        <select
          className="library-browser__select"
          aria-label={t('order')}
          value={order}
          onChange={(event) => onOrderChange(event.target.value as LibraryOrder)}
        >
          <option value={LibraryOrder.Ascending}>{t(SORT_ORDER_LABELS[sort].ascending)}</option>
          <option value={LibraryOrder.Descending}>{t(SORT_ORDER_LABELS[sort].descending)}</option>
        </select>
      </label>
      <nav className="library-browser__pages" aria-label={t('pagination')}>
        <Button
          aria-label={t('previousPage')}
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
        >
          <Icon name={IconName.Previous} />
        </Button>
        {pageNumbers.map((number) => (
          <Button
            key={number}
            className={number === current ? 'library-browser__page' : undefined}
            aria-current={number === current ? 'page' : undefined}
            onClick={() => onPageChange(number)}
          >
            {number}
          </Button>
        ))}
        <Button
          aria-label={t('nextPage')}
          disabled={current === pages}
          onClick={() => onPageChange(current + 1)}
        >
          <Icon name={IconName.Next} />
        </Button>
      </nav>
    </div>
  );
}
