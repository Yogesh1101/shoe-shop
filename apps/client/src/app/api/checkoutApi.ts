import type { Quote, QuoteRequest } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export const checkoutApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * A mutation, not a query: the cart, address and payment method change on
     * almost every keystroke, and each call re-reads prices, stock and GST
     * slabs from the database. There is nothing here worth caching by key.
     */
    getQuote: build.mutation<Quote, QuoteRequest>({
      query: (body) => ({ url: '/checkout/quote', method: 'POST', body }),
    }),
  }),
});

export const { useGetQuoteMutation } = checkoutApi;
