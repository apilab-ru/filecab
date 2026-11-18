import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Category, CatalogSearchRequest, Locale } from '@filecab/contracts';
import { useInterfacePreferences } from './use-interface-preferences';

export const CATALOG_FILTER_FIELDS = ['year', 'format', 'type'];

export const CATALOG_PAGE_SIZE = 12;

const NUMERIC_FILTERS = new Set(['year']);

/** Reads the route filter values that are present, converting numeric filters. */
function readFilters(parameters: URLSearchParams) {
  return Object.fromEntries(
    CATALOG_FILTER_FIELDS.flatMap((key) => {
      const value = parameters.get(key);

      if (!value) return [];

      return [[key, NUMERIC_FILTERS.has(key) ? Number(value) : value]];
    }),
  );
}

/** Keeps catalog search options in the route query and resets the page when the scope changes. */
export function useCatalogRoute(category: Category) {
  const { locale } = useInterfacePreferences();
  const [parameters, setParameters] = useSearchParams();
  const previousScope = useRef({ locale, category });
  const query = parameters.get('q') ?? '';
  const page = Math.max(1, Number(parameters.get('page')) || 1);
  const order = parameters.get('order') || undefined;
  const request: CatalogSearchRequest = {
    category,
    query,
    locale: locale as Locale,
    page,
    pageSize: CATALOG_PAGE_SIZE,
    filters: readFilters(parameters),
    order,
  };

  /** Writes one route value. Any change except a page change returns to the first page. */
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(parameters);

    if (value) next.set(key, value);
    else next.delete(key);

    if (key !== 'page') next.set('page', '1');

    if (key === 'q') {
      CATALOG_FILTER_FIELDS.forEach((field) => next.delete(field));
      next.delete('order');
    }

    setParameters(next, { replace: true });
  };

  useEffect(() => {
    if (previousScope.current.locale === locale && previousScope.current.category === category)
      return;

    previousScope.current = { locale, category };
    setParameters(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('page', '1');

        return next;
      },
      { replace: true },
    );
  }, [locale, category]);

  return {
    view: parameters.get('view') === 'list' ? ('list' as const) : ('cards' as const),
    query,
    page,
    order,
    request,
    value: (key: string) => parameters.get(key) ?? '',
    update,
  };
}
