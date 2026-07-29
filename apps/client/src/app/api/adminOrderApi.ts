import type { AdminOrder, AdminOrderListQuery, UpdateOrderStatusInput } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export interface AdminOrderListResponse {
  items: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function toQueryString(params: Partial<AdminOrderListQuery>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  return search.toString();
}

export const adminOrderApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminOrders: build.query<AdminOrderListResponse, Partial<AdminOrderListQuery>>({
      query: (params) => `/admin/orders?${toQueryString(params)}`,
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ _id }) => ({ type: 'Order' as const, id: _id })),
              { type: 'Order' as const, id: 'LIST' },
            ]
          : [{ type: 'Order' as const, id: 'LIST' }],
    }),

    getAdminOrder: build.query<AdminOrder, string>({
      query: (id) => `/admin/orders/${id}`,
      providesTags: (result) => (result ? [{ type: 'Order', id: result._id }] : []),
    }),

    updateOrderStatus: build.mutation<AdminOrder, { id: string } & UpdateOrderStatusInput>({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Order', id },
        { type: 'Order', id: 'LIST' },
      ],
    }),
  }),
});

export const { useGetAdminOrdersQuery, useGetAdminOrderQuery, useUpdateOrderStatusMutation } =
  adminOrderApi;
