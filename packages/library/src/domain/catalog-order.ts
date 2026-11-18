import type { CatalogProviderCapability } from '@filecab/contracts';
import { SortDirection } from '../models/sort-direction';

const DIRECTION_SUFFIX = /-(asc|desc)$/;

/** Splits a provider order value such as `year-desc` into its field and direction. */
export function parseOrder(value: string) {
  const direction = DIRECTION_SUFFIX.exec(value)?.[1] as SortDirection | undefined;

  return { field: value.replace(DIRECTION_SUFFIX, ''), direction };
}

/** Returns the filters and orders that the provider supports for a browse or a text search. */
export function allowedCatalogOptions(
  capability: CatalogProviderCapability | undefined,
  query: string,
) {
  if (!capability) return { filters: [], orders: [] };

  if (!query.trim()) return { filters: capability.filters, orders: capability.ordering };

  return {
    filters: capability.searchFilters ?? capability.filters,
    orders: capability.searchOrdering ?? capability.ordering,
  };
}

/** Lists the distinct sort fields of the supported orders in their advertised sequence. */
export function orderFields(orders: string[]) {
  return [...new Set(orders.map((value) => parseOrder(value).field))];
}

/** Lists the supported order values with an explicit direction for one field. */
export function fieldDirections(orders: string[], field: string) {
  return orders.filter((value) => {
    const parsed = parseOrder(value);

    return parsed.direction && parsed.field === field;
  });
}

/** Selects the order for a new field, keeping the current direction when the field supports it. */
export function orderForField(orders: string[], field: string, current?: string) {
  if (!field) return '';

  const direction = (current && parseOrder(current).direction) || SortDirection.Asc;
  const preferred = `${field}-${direction}`;

  return (
    orders.find((value) => value === preferred) ??
    orders.find((value) => parseOrder(value).field === field) ??
    ''
  );
}
