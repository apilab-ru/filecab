import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import '../../styles/library-browser-shared.scss';
import '../../styles/library-pagination.scss';

import { Button, Icon, IconName } from '@filecab/ui';
import { SortDirection } from '../../models/sort-direction';
import { SortControls } from '../sort-controls/sort-controls';
import { PAGE_SIZE, SORT_ORDER_LABELS } from '../library-browser/model-library-browser';
import {
  SORT_FIELDS,
  type LibraryBrowserPaginationProps,
} from './model-library-browser-pagination';

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
      <SortControls
        field={sort}
        fields={SORT_FIELDS.map(({ value, label }) => ({ value, label: t(label) }))}
        fieldPlaceholder={t('sortBy')}
        onFieldChange={onSortChange}
        direction={order}
        directions={[
          { value: SortDirection.Asc, label: t(SORT_ORDER_LABELS[sort].ascending) },
          { value: SortDirection.Desc, label: t(SORT_ORDER_LABELS[sort].descending) },
        ]}
        onDirectionChange={onOrderChange}
      />
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
