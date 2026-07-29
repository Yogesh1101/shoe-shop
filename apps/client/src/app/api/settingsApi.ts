import type { PublicSettings } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export const settingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Shop name, contact details and delivery rules. Deliberately a narrow
     * subset of the settings document — the COD thresholds, GST slabs and
     * blocked PIN list stay server-side.
     */
    getPublicSettings: build.query<PublicSettings, void>({
      query: () => '/settings/public',
      providesTags: [{ type: 'Settings', id: 'PUBLIC' }],
    }),
  }),
});

export const { useGetPublicSettingsQuery } = settingsApi;
