import type { Settings, SettingsUpdate } from '@shoe-shop/shared';

import { baseApi } from '@/app/api/baseApi';

export const adminSettingsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminSettings: build.query<Settings, void>({
      query: () => '/admin/settings',
      providesTags: [{ type: 'Settings', id: 'ADMIN' }],
    }),

    updateAdminSettings: build.mutation<Settings, SettingsUpdate>({
      query: (body) => ({ url: '/admin/settings', method: 'PATCH', body }),
      // The storefront's public settings (delivery, COD, shop name) can change
      // too, so both caches are invalidated together.
      invalidatesTags: [
        { type: 'Settings', id: 'ADMIN' },
        { type: 'Settings', id: 'PUBLIC' },
      ],
    }),
  }),
});

export const { useGetAdminSettingsQuery, useUpdateAdminSettingsMutation } = adminSettingsApi;
