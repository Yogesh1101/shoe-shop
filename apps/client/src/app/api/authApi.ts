import type { AdminLoginInput, LoginResponse } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, AdminLoginInput>({
      query: (body) => ({ url: '/admin/login', method: 'POST', body }),
    }),

    /**
     * Trades the httpOnly refresh cookie for a fresh access token. The client
     * calls this once, on entering the admin panel — the access token lives
     * only in memory, so every page load starts signed out until this settles.
     */
    refresh: build.mutation<LoginResponse, void>({
      query: () => ({ url: '/admin/refresh', method: 'POST' }),
    }),

    logout: build.mutation<void, void>({
      query: () => ({ url: '/admin/logout', method: 'POST' }),
    }),
  }),
});

export const { useLoginMutation, useRefreshMutation, useLogoutMutation } = authApi;
