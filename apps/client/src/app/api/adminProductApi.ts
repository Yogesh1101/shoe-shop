import type { Product, ProductImage, ProductInput, ProductUpdate } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';
import { type ProductListParams, type ProductListResponse, toQueryString } from '@/app/api/productApi';

export const adminProductApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /** Unlike the public listing, this always includes unpublished shoes. */
    getAdminProducts: build.query<ProductListResponse, ProductListParams>({
      query: (params) => `/admin/products?${toQueryString(params)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ _id }) => ({ type: 'Product' as const, id: _id })),
              { type: 'Product' as const, id: 'LIST' },
            ]
          : [{ type: 'Product' as const, id: 'LIST' }],
    }),

    getAdminProduct: build.query<Product, string>({
      query: (id) => `/admin/products/${id}`,
      providesTags: (result) => (result ? [{ type: 'Product', id: result._id }] : []),
    }),

    createProduct: build.mutation<Product, ProductInput>({
      query: (body) => ({ url: '/admin/products', method: 'POST', body }),
      invalidatesTags: [
        { type: 'Product', id: 'LIST' },
        { type: 'Facets', id: 'ALL' },
      ],
    }),

    updateProduct: build.mutation<Product, { id: string; patch: ProductUpdate }>({
      query: ({ id, patch }) => ({ url: `/admin/products/${id}`, method: 'PATCH', body: patch }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        { type: 'Facets', id: 'ALL' },
      ],
    }),

    deleteProduct: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/products/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Product', id },
        { type: 'Product', id: 'LIST' },
        { type: 'Facets', id: 'ALL' },
      ],
    }),

    /** Returns `{ url, publicId }` per file — the form appends these to a variant's images. */
    uploadProductImages: build.mutation<{ images: ProductImage[] }, File[]>({
      query: (files) => {
        const formData = new FormData();
        for (const file of files) formData.append('images', file);
        return { url: '/admin/products/images', method: 'POST', body: formData };
      },
    }),
  }),
});

export const {
  useGetAdminProductsQuery,
  useGetAdminProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useUploadProductImagesMutation,
} = adminProductApi;
