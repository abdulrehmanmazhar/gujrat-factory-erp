import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Labourer, LabourProductionEntry } from '@/types/api'

export const LABOUR_MUTATION_TAGS = ['Labourers', 'LabourProduction', 'Products', 'Transactions'] as const

export const labourApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getLabourers: builder.query<{ labourers: Labourer[] }, boolean | void>({
            query: (includeInactive) => ({
                url: '/labourers',
                params: includeInactive ? { includeInactive: 'true' } : undefined
            }),
            transformResponse: (response: ApiEnvelope<{ labourers: Labourer[] }>) => unwrapData(response),
            providesTags: ['Labourers']
        }),
        getLabourer: builder.query<{ labourer: Labourer }, string>({
            query: (id) => `/labourers/${id}`,
            transformResponse: (response: ApiEnvelope<{ labourer: Labourer }>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Labourers', id }]
        }),
        createLabourer: builder.mutation<ApiEnvelope<{ labourer: Labourer }>, { name: string; contact?: string; notes?: string }>({
            query: (body) => ({ url: '/labourers', method: 'POST', body }),
            invalidatesTags: ['Labourers']
        }),
        updateLabourer: builder.mutation<
            ApiEnvelope<{ labourer: Labourer }>,
            { id: string; name?: string; contact?: string; notes?: string; isActive?: boolean }
        >({
            query: ({ id, ...body }) => ({ url: `/labourers/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Labourers']
        }),
        setLabourRate: builder.mutation<ApiEnvelope<{ labourer: Labourer }>, { labourerId: string; productId: string; ratePerUnit: number }>({
            query: ({ labourerId, ...body }) => ({
                url: `/labourers/${labourerId}/rates`,
                method: 'POST',
                body
            }),
            invalidatesTags: ['Labourers']
        }),
        removeLabourRate: builder.mutation<ApiEnvelope<{ labourer: Labourer }>, { labourerId: string; productId: string }>({
            query: ({ labourerId, productId }) => ({
                url: `/labourers/${labourerId}/rates/${productId}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Labourers']
        }),
        getProductionEntries: builder.query<{ entries: LabourProductionEntry[] }, void>({
            query: () => '/labour/production',
            transformResponse: (response: ApiEnvelope<{ entries: LabourProductionEntry[] }>) => unwrapData(response),
            providesTags: ['LabourProduction']
        }),
        recordProduction: builder.mutation<
            ApiEnvelope<{ entry: LabourProductionEntry }>,
            { labourerId: string; productId: string; qtyProduced: number; notes?: string }
        >({
            query: (body) => ({ url: '/labour/production', method: 'POST', body }),
            invalidatesTags: [...LABOUR_MUTATION_TAGS]
        })
    })
})

export const {
    useGetLabourersQuery,
    useGetLabourerQuery,
    useCreateLabourerMutation,
    useUpdateLabourerMutation,
    useSetLabourRateMutation,
    useRemoveLabourRateMutation,
    useGetProductionEntriesQuery,
    useRecordProductionMutation
} = labourApi
