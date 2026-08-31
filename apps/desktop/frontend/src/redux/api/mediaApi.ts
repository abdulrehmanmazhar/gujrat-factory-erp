import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import constants from '@/constants/app'
import type { ApiEnvelope } from '@/types/api'

export type MediaKindFilter = 'all' | 'proof' | 'invoice' | 'receipt' | 'document'

export type MediaCatalogItem = {
    id: string
    source: 'customer_proof' | 'supplier_proof' | 'misc_proof' | 'whatsapp'
    kind: 'proof' | 'invoice' | 'receipt' | 'document'
    fileName: string
    partyName: string | null
    contact: string | null
    orderNumber: number | null
    amount: number | null
    createdAt: string | null
}

export type MediaListResponse = {
    items: MediaCatalogItem[]
    total: number
    page: number
    limit: number
}

export const mediaApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMedia: builder.query<MediaListResponse, { q?: string; kind?: MediaKindFilter; page?: number; limit?: number }>({
            query: ({ q = '', kind = 'all', page = 1, limit = 20 } = {}) => ({
                url: '/media',
                params: {
                    q: q || undefined,
                    kind: kind === 'all' ? undefined : kind,
                    page: String(page),
                    limit: String(limit)
                }
            }),
            transformResponse: (response: ApiEnvelope<MediaListResponse>) => unwrapData(response),
            providesTags: ['Media']
        })
    })
})

export const { useGetMediaQuery } = mediaApi

export async function fetchMediaBlob(id: string, getToken: () => string | null, disposition: 'inline' | 'attachment' = 'attachment') {
    const token = getToken()
    const url = `${constants.API_BASE}/media/file?id=${encodeURIComponent(id)}&disposition=${disposition}`
    const response = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })

    if (!response.ok) {
        let message = 'Could not load media file'
        try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) message = payload.message
        } catch {
            /* ignore */
        }
        throw new Error(message)
    }

    const blob = await response.blob()
    const dispositionHeader = response.headers.get('Content-Disposition') ?? ''
    const match = dispositionHeader.match(/filename="?([^"]+)"?/)
    const fileName = match?.[1] ?? 'download'
    return { blob, fileName, contentType: response.headers.get('Content-Type') ?? blob.type }
}
