import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'
import type { AppLanguage } from '@/lib/i18n-storage'

export type AppSettings = {
    documentLanguage: AppLanguage
    posBannerUrl: string | null
    posBannerPublicId: string | null
    posBannerHeightPx: number
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
        updateSettings: builder.mutation<SettingsPayload, { documentLanguage?: AppLanguage; posBannerHeightPx?: number }>({
            query: (body) => ({
                url: '/settings',
                method: 'PUT',
                body
            }),
            transformResponse: (response: ApiEnvelope<SettingsPayload>) => unwrapData(response),
            invalidatesTags: ['Settings']
        }),
        uploadPosBanner: builder.mutation<SettingsPayload, File>({
            query: (file) => {
                const body = new FormData()
                body.append('banner', file)
                return {
                    url: '/settings/pos-banner',
                    method: 'POST',
                    body
                }
            },
            transformResponse: (response: ApiEnvelope<SettingsPayload>) => unwrapData(response),
            invalidatesTags: ['Settings']
        }),
        removePosBanner: builder.mutation<SettingsPayload, void>({
            query: () => ({
                url: '/settings/pos-banner',
                method: 'DELETE'
            }),
            transformResponse: (response: ApiEnvelope<SettingsPayload>) => unwrapData(response),
            invalidatesTags: ['Settings']
        })
    })
})

export const { useGetSettingsQuery, useUpdateSettingsMutation, useUploadPosBannerMutation, useRemovePosBannerMutation } = settingsApi

export const DEFAULT_POS_BANNER_HEIGHT = 200
export const MIN_POS_BANNER_HEIGHT = 60
export const MAX_POS_BANNER_HEIGHT = 400
