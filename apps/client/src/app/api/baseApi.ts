import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { RootState } from '@/app/store';

/**
 * The single RTK Query instance.
 *
 * `createApi` is called exactly once, here, with no endpoints. Every feature
 * adds its own through `baseApi.injectEndpoints`, which keeps store wiring in
 * one file and lets each feature's endpoints code-split with its route.
 */

/** The server's error envelope, from apps/server/src/utils/ApiError.ts. */
interface ApiErrorEnvelope {
  error: { message: string; code: string; details?: unknown };
}

/** What components actually see — flat, always populated. */
export interface NormalisedError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

function isErrorEnvelope(data: unknown): data is ApiErrorEnvelope {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as ApiErrorEnvelope).error?.message === 'string'
  );
}

/**
 * Flatten the server's `{ error: { … } }` envelope once, here, so no component
 * ever reaches through `error.data.error.message` — and so a network failure,
 * which has no envelope at all, still arrives with a readable message instead
 * of rendering "undefined".
 */
export function normaliseError(error: unknown): NormalisedError {
  const raw = error as { status?: number | string; data?: unknown } | undefined;

  if (isErrorEnvelope(raw?.data)) {
    return {
      status: typeof raw.status === 'number' ? raw.status : 500,
      code: raw.data.error.code,
      message: raw.data.error.message,
      details: raw.data.error.details,
    };
  }

  // FETCH_ERROR is RTK Query's marker for "the request never completed" —
  // offline, DNS failure, CORS, or the free Render instance still waking up.
  if (raw?.status === 'FETCH_ERROR') {
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the shop. Check your connection and try again.',
    };
  }

  return {
    status: typeof raw?.status === 'number' ? raw.status : 500,
    code: 'UNKNOWN_ERROR',
    message: 'Something went wrong. Please try again.',
  };
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: `${import.meta.env.VITE_API_URL ?? ''}/api`,
    // Carries the admin refresh cookie. The API (Render) and storefront
    // (Vercel) are different origins, which is why CORS is configured with an
    // explicit allowlist rather than a wildcard.
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  /**
   * Invalidation targets. The payoff arrives in phase 9: editing a shoe in the
   * admin panel invalidates `Product` and `Facets`, so the storefront grid and
   * the filter sidebar both refresh with no manual refetch anywhere.
   */
  tagTypes: ['Product', 'Facets', 'Settings', 'Order'],
  endpoints: () => ({}),
});
