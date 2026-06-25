import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'
import type { AppLanguage } from '@/lib/i18n-storage'

export type AppSettings = {
    documentLanguage: AppLanguage
}

type SettingsPayload = {
    settings: AppSettings
}

export const settingsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getSettings: builder.query<SettingsPayload, void>({
            query: () => '/settings',
            transformResponse: (response: ApiEnvelope<SettingsPayload>) => unwrapData(response),
            providesTags: ['Settings']
        }),
        updateSettings: builder.mutation<SettingsPayload, { documentLanguage: AppLanguage }>({
            query: (body) => ({
                url: '/settings',
                method: 'PUT',
                body
            }),
            transformResponse: (response: ApiEnvelope<SettingsPayload>) => unwrapData(response),
            invalidatesTags: ['Settings']
        })
    })
})

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi
