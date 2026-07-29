import { DEFAULT_PAGE_SIZE, type ProductSort } from '@shoe-shop/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ProductListParams } from '@/app/api/productApi';

/**
 * Catalog filter state, held in the URL rather than in component state.
 *
 * This is the right home for it because the URL is the thing people share. A
 * filtered view is then linkable, the back button steps through filter changes,
 * and a refresh keeps the view — all of which matter when most traffic is
 * someone tapping a link in an Instagram bio.
 *
 * The shape maps 1:1 onto the server's `productListQuerySchema`, which already
 * parses comma-separated values like `?brand=Nike,Puma`.
 */

function readList(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export interface CatalogFilters {
  q?: string;
  category?: string;
  type?: string;
  brand: string[];
  color: string[];
  size: number[];
  sort: ProductSort;
  page: number;
}

export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<CatalogFilters>(() => {
    const q = searchParams.get('q') ?? undefined;
    return {
      q,
      category: searchParams.get('category') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      brand: readList(searchParams, 'brand'),
      color: readList(searchParams, 'color'),
      size: readList(searchParams, 'size')
        .map(Number)
        .filter((size) => Number.isFinite(size)),
      // A search with no explicit sort should rank by relevance; browsing
      // without one should show the newest stock first.
      sort: (searchParams.get('sort') as ProductSort | null) ?? (q ? 'relevance' : 'newest'),
      page: Math.max(1, Number(searchParams.get('page') ?? 1) || 1),
    };
  }, [searchParams]);

  /** Params for `useGetProductsQuery`. */
  const queryParams = useMemo<ProductListParams>(
    () => ({
      q: filters.q,
      category: filters.category,
      type: filters.type,
      brand: filters.brand,
      color: filters.color,
      size: filters.size,
      sort: filters.sort,
      page: filters.page,
      limit: DEFAULT_PAGE_SIZE,
    }),
    [filters],
  );

  const setFilter = useCallback(
    (key: string, value: string | string[] | number | undefined) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          const serialised = Array.isArray(value) ? value.join(',') : value?.toString();

          if (!serialised) next.delete(key);
          else next.set(key, serialised);

          // Any filter change invalidates the current page number — staying on
          // page 4 of a result set that now has two pages shows nothing.
          if (key !== 'page') next.delete('page');

          return next;
        },
        { preventScrollReset: key === 'page' ? false : true },
      );
    },
    [setSearchParams],
  );

  /** Add or remove one value from a multi-select filter. */
  const toggleFilter = useCallback(
    (key: 'brand' | 'color' | 'size', value: string) => {
      const current = readList(searchParams, key);
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      setFilter(key, next);
    },
    [searchParams, setFilter],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((previous) => {
      const next = new URLSearchParams();
      // The search term is what the shopper typed, not a filter they ticked —
      // clearing filters should narrow nothing away from their query.
      const q = previous.get('q');
      if (q) next.set('q', q);
      return next;
    });
  }, [setSearchParams]);

  const activeFilterCount =
    filters.brand.length +
    filters.color.length +
    filters.size.length +
    (filters.category ? 1 : 0) +
    (filters.type ? 1 : 0);

  return { filters, queryParams, setFilter, toggleFilter, clearFilters, activeFilterCount };
}
