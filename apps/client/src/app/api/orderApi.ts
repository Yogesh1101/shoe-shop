import type {
  CreateOrderInput,
  CreateOrderResponse,
  PublicOrder,
  TrackOrderQuery,
  VerifyPaymentInput,
} from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export const orderApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createOrder: build.mutation<CreateOrderResponse, CreateOrderInput>({
      query: (body) => ({ url: '/orders', method: 'POST', body }),
    }),

    /** The checkout page's callback once Razorpay Checkout reports success. */
    verifyPayment: build.mutation<PublicOrder, { orderId: string } & VerifyPaymentInput>({
      query: ({ orderId, ...body }) => ({
        url: `/orders/${orderId}/verify-payment`,
        method: 'POST',
        body,
      }),
    }),

    /** Guest order lookup — there are no accounts, so the phone number on the order is the key. */
    trackOrder: build.query<PublicOrder, TrackOrderQuery>({
      query: ({ orderNumber, phone }) => ({
        url: '/orders/track',
        params: { orderNumber, phone },
      }),
      providesTags: (result) => (result ? [{ type: 'Order', id: result.orderNumber }] : []),
    }),
  }),
});

export const { useCreateOrderMutation, useVerifyPaymentMutation, useTrackOrderQuery } = orderApi;
