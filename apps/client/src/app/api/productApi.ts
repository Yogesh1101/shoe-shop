import type { Product, ProductFacets } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export interface ProductListResponse {
  items: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Filters as the catalog page holds them, mirroring `productListQuerySchema`. */
export interface ProductListParams {
  q?: string;
  /** Resolve specific products — used by the cart, which stores only ids. */
  ids?: string[];
  category?: string;
  type?: string;
  brand?: string[];
  color?: string[];
  size?: number[];
  minPricePaise?: number;
  maxPricePaise?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

/**
 * Arrays go over the wire comma-separated (`?brand=Nike,Puma`), which is what
 * the server's `csvArray` transform already parses — and it keeps the shareable
 * catalog URL readable instead of repeating the key five times.
 */
function toQueryString(params: ProductListParams): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
      continue;
    }
    search.set(key, String(value));
  }

  return search.toString();
}

export const productApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProducts: build.query<ProductListResponse, ProductListParams>({
      query: (params) => `/products?${toQueryString(params)}`,
      // Tagging each id as well as the LIST lets a single product edit
      // invalidate precisely the queries that showed it.
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ _id }) => ({ type: 'Product' as const, id: _id })),
              { type: 'Product' as const, id: 'LIST' },
            ]
          : [{ type: 'Product' as const, id: 'LIST' }],
    }),

    getProduct: build.query<Product, string>({
      query: (slug) => `/products/${slug}`,
      providesTags: (result) => (result ? [{ type: 'Product', id: result._id }] : []),
    }),

    getFacets: build.query<ProductFacets, void>({
      query: () => '/products/facets',
      providesTags: [{ type: 'Facets', id: 'ALL' }],
    }),
  }),
});

export const { useGetProductsQuery, useGetProductQuery, useGetFacetsQuery } = productApi;
