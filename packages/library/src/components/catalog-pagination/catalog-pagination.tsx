import { useTranslation } from 'react-i18next';
import { Button, Icon, IconName } from '@filecab/ui';
import '../../styles/library-browser-shared.scss';
import '../../styles/library-pagination.scss';
import {
  fieldDirections,
  orderFields,
  orderForField,
  parseOrder,
} from '../../domain/catalog-order';
import { SortControls } from '../sort-controls/sort-controls';
import { SortDirection } from '../../models/sort-direction';
import {
  DEFAULT_DIRECTION_LABELS,
  DIRECTION_LABELS,
  SORT_FIELD_LABELS,
  type CatalogPaginationProps,
} from './model-catalog-pagination';

/** Renders provider-supported ordering and continuation-based catalog page navigation. */
export function CatalogPagination({
  page,
  lastPage,
  hasMore,
  loading,
  hasResult,
  sortable,
  orders,
  order,
  onOrderChange,
  onPageChange,
}: CatalogPaginationProps) {
  const { t } = useTranslation();
  const field = order ? parseOrder(order).field : '';
  const directions = fieldDirections(orders, field);

  /** Labels a sort field, falling back to the provider field name. */
  const fieldLabel = (value: string) => {
    if (value in SORT_FIELD_LABELS)
      return t(SORT_FIELD_LABELS[value as keyof typeof SORT_FIELD_LABELS]);

    return value === 'id' ? 'ID' : value;
  };

  /** Labels a direction with field-specific wording when it exists. */
  const directionLabel = (value: string) => {
    const direction = parseOrder(value).direction ?? SortDirection.Asc;
    const labels =
      field in DIRECTION_LABELS
        ? DIRECTION_LABELS[field as keyof typeof DIRECTION_LABELS]
        : DEFAULT_DIRECTION_LABELS;

    return t(labels[direction]);
  };

  return (
    <div className="library-browser__pagination">
      <span>
        {t('page')} {page}
        {lastPage !== undefined ? ` / ${lastPage}` : ''}
      </span>
      {sortable && (
        <SortControls
          field={field}
          fields={[
            { value: '', label: t('catalogProviderOrder') },
            ...orderFields(orders).map((value) => ({ value, label: fieldLabel(value) })),
          ]}
          fieldPlaceholder={t('catalogProviderOrder')}
          fieldDisabled={loading || !orders.length}
          onFieldChange={(value) => onOrderChange(orderForField(orders, value, order))}
          direction={order ?? ''}
          directions={directions.map((value) => ({ value, label: directionLabel(value) }))}
          directionDisabled={loading || !field || !directions.length}
          onDirectionChange={onOrderChange}
        />
      )}
      <nav className="library-browser__pages" aria-label={t('pagination')}>
        <Button
          aria-label={t('previousPage')}
          disabled={loading || !hasResult || page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icon name={IconName.Previous} />
        </Button>
        <Button className="library-browser__page" aria-current="page">
          {page}
        </Button>
        <Button
          aria-label={t('nextPage')}
          disabled={loading || !hasMore}
          onClick={() => onPageChange(page + 1)}
        >
          <Icon name={IconName.Next} />
        </Button>
        {lastPage !== undefined && (
          <Button onClick={() => onPageChange(lastPage)}>{t('lastPage')}</Button>
        )}
      </nav>
    </div>
  );
}
