import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'
import type { WhatsAppQueueStats } from '@/hooks/useWhatsAppSocket'

export type WhatsAppStatusResponse = WhatsAppQueueStats & {
    connected: boolean
}

export const whatsappApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getWhatsAppStatus: builder.query<WhatsAppStatusResponse, void>({
            query: () => '/whatsapp/status',
            transformResponse: (response: ApiEnvelope<WhatsAppStatusResponse>) => unwrapData(response),
            providesTags: ['WhatsApp']
        }),
        logoutWhatsApp: builder.mutation<ApiEnvelope<{ connected: boolean }>, void>({
            query: () => ({
                url: '/whatsapp/logout',
                method: 'POST'
            }),
            invalidatesTags: ['WhatsApp']
        })
    })
})

export const { useGetWhatsAppStatusQuery, useLogoutWhatsAppMutation } = whatsappApi
