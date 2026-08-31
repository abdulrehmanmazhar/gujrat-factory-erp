import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'
import type { WhatsAppQueueItem, WhatsAppQueueStats } from '@/hooks/useWhatsAppSocket'

export type WhatsAppStatusResponse = WhatsAppQueueStats & {
    connected: boolean
}

export type WhatsAppQueueListResponse = {
    items: WhatsAppQueueItem[]
    total: number
    page: number
    limit: number
    counts: WhatsAppQueueStats['counts']
}

export type WhatsAppQueueStatusFilter = 'all' | 'pending' | 'processing' | 'sent' | 'failed'

export const whatsappApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getWhatsAppStatus: builder.query<WhatsAppStatusResponse, void>({
            query: () => '/whatsapp/status',
            transformResponse: (response: ApiEnvelope<WhatsAppStatusResponse>) => unwrapData(response),
            providesTags: ['WhatsApp']
        }),
        getWhatsAppQueue: builder.query<WhatsAppQueueListResponse, { status?: WhatsAppQueueStatusFilter; page?: number; limit?: number }>({
            query: ({ status = 'all', page = 1, limit = 20 } = {}) => ({
                url: '/whatsapp/queue',
                params: {
                    status: status === 'all' ? undefined : status,
                    page: String(page),
                    limit: String(limit)
                }
            }),
            transformResponse: (response: ApiEnvelope<WhatsAppQueueListResponse>) => unwrapData(response),
            providesTags: ['WhatsApp']
        }),
        retryWhatsAppQueueItem: builder.mutation<{ id: string; status: string }, string>({
            query: (id) => ({
                url: `/whatsapp/queue/${id}/retry`,
                method: 'POST'
            }),
            transformResponse: (response: ApiEnvelope<{ id: string; status: string }>) => unwrapData(response),
            invalidatesTags: ['WhatsApp']
        }),
        retryFailedWhatsAppQueue: builder.mutation<{ retried: number }, void>({
            query: () => ({
                url: '/whatsapp/queue/retry-failed',
                method: 'POST'
            }),
            transformResponse: (response: ApiEnvelope<{ retried: number }>) => unwrapData(response),
            invalidatesTags: ['WhatsApp']
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

export const {
    useGetWhatsAppStatusQuery,
    useGetWhatsAppQueueQuery,
    useRetryWhatsAppQueueItemMutation,
    useRetryFailedWhatsAppQueueMutation,
    useLogoutWhatsAppMutation
} = whatsappApi
