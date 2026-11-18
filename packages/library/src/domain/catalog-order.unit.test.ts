import { describe, expect, it } from 'vitest';
import { allowedCatalogOptions, orderForField } from './catalog-order';
import type { CatalogProviderCapability } from '@filecab/contracts';

const orders = ['id', 'year-asc', 'year-desc', 'rating-desc'];

describe('catalog order', () => {
  it('keeps the current direction when the new field supports it', () => {
    expect(orderForField(orders, 'year', 'rating-desc')).toBe('year-desc');
  });

  it('selects the first supported direction when the current one is not supported', () => {
    expect(orderForField(orders, 'rating', 'year-asc')).toBe('rating-desc');
    expect(orderForField(orders, 'id', 'year-desc')).toBe('id');
  });

  it('uses the provider default order when no field is selected', () => {
    expect(orderForField(orders, '', 'year-desc')).toBe('');
  });

  it('uses search capabilities only for a text query', () => {
    const capability = {
      filters: ['year', 'format'],
      ordering: orders,
      searchFilters: ['year'],
      searchOrdering: [],
    } as unknown as CatalogProviderCapability;

    expect(allowedCatalogOptions(capability, '  ')).toEqual({
      filters: ['year', 'format'],
      orders,
    });
    expect(allowedCatalogOptions(capability, 'title')).toEqual({ filters: ['year'], orders: [] });
  });
});
