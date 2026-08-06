import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Labourer, LabourProductionEntry, LabourTransactionCategory, LabourerTransaction } from '@/types/api'

export const LABOUR_MUTATION_TAGS = ['Labourers', 'LabourProduction', 'LabourerTransactions', 'Products'] as const

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
        setLabourRatesByCategories: builder.mutation<
            ApiEnvelope<{ labourer: Labourer; updated: number; productIds: string[] }>,
            { labourerId: string; categoryIds: string[]; ratePerUnit: number }
        >({
            query: ({ labourerId, ...body }) => ({
                url: `/labourers/${labourerId}/rates/by-categories`,
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
        }),
        getLabourTransactions: builder.query<{ transactions: LabourerTransaction[] }, string | void>({
            query: (labourerId) => ({
                url: '/labour/transactions',
                params: labourerId ? { labourerId } : undefined
            }),
            transformResponse: (response: ApiEnvelope<{ transactions: LabourerTransaction[] }>) => unwrapData(response),
            providesTags: ['LabourerTransactions']
        }),
        createLabourTransaction: builder.mutation<
            ApiEnvelope<{ transaction: LabourerTransaction }>,
            { labourerId: string; amount: number; category: Exclude<LabourTransactionCategory, 'production'>; description: string }
        >({
            query: (body) => ({ url: '/labour/transactions', method: 'POST', body }),
            invalidatesTags: ['LabourerTransactions']
        }),
        deleteLabourTransaction: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/labour/transactions/${id}`, method: 'DELETE' }),
            invalidatesTags: ['LabourerTransactions']
        })
    })
})

export const {
    useGetLabourersQuery,
    useGetLabourerQuery,
    useCreateLabourerMutation,
    useUpdateLabourerMutation,
    useSetLabourRateMutation,
    useSetLabourRatesByCategoriesMutation,
    useRemoveLabourRateMutation,
    useGetProductionEntriesQuery,
    useRecordProductionMutation,
    useGetLabourTransactionsQuery,
    useCreateLabourTransactionMutation,
    useDeleteLabourTransactionMutation
} = labourApi
