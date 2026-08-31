import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, MiscExpenditureCategory, MiscellaneousExpenditure } from '@/types/api'

export type CreateMiscExpenditureInput = {
    amount: number
    paymentMode: 'cash' | 'online'
    note: string
    categoryId: string
    proofImage?: File | null
}

export const miscExpenditureApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMiscExpenditures: builder.query<{ expenditures: MiscellaneousExpenditure[] }, void>({
            query: () => '/miscellaneous-expenditures',
            transformResponse: (response: ApiEnvelope<{ expenditures: MiscellaneousExpenditure[] }>) => unwrapData(response),
            providesTags: ['MiscExpenditures']
        }),
        getMiscExpenditureCategories: builder.query<{ categories: MiscExpenditureCategory[] }, void>({
            query: () => '/miscellaneous-expenditure-categories',
            transformResponse: (response: ApiEnvelope<{ categories: MiscExpenditureCategory[] }>) => unwrapData(response),
            providesTags: ['MiscExpenditures']
        }),
        createMiscExpenditureCategory: builder.mutation<
            { category: MiscExpenditureCategory },
            { name: string; parentId?: string | null; sortOrder?: number }
        >({
            query: (body) => ({ url: '/miscellaneous-expenditure-categories', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ category: MiscExpenditureCategory }>) => unwrapData(response),
            invalidatesTags: ['MiscExpenditures']
        }),
        updateMiscExpenditureCategory: builder.mutation<
            { category: MiscExpenditureCategory },
            { id: string; name?: string; parentId?: string | null; sortOrder?: number }
        >({
            query: ({ id, ...body }) => ({ url: `/miscellaneous-expenditure-categories/${id}`, method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<{ category: MiscExpenditureCategory }>) => unwrapData(response),
            invalidatesTags: ['MiscExpenditures']
        }),
        deleteMiscExpenditureCategory: builder.mutation<null, string>({
            query: (id) => ({ url: `/miscellaneous-expenditure-categories/${id}`, method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<null>) => unwrapData(response),
            invalidatesTags: ['MiscExpenditures']
        }),
        createMiscExpenditure: builder.mutation<{ expenditure: MiscellaneousExpenditure }, CreateMiscExpenditureInput>({
            query: ({ amount, paymentMode, note, categoryId, proofImage }) => {
                const body = new FormData()
                body.append('amount', String(amount))
                body.append('paymentMode', paymentMode)
                body.append('note', note)
                body.append('categoryId', categoryId)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: '/miscellaneous-expenditures', method: 'POST', body }
            },
            transformResponse: (response: ApiEnvelope<{ expenditure: MiscellaneousExpenditure }>) => unwrapData(response),
            invalidatesTags: ['MiscExpenditures']
        }),
        deleteMiscExpenditure: builder.mutation<null, string>({
            query: (id) => ({ url: `/miscellaneous-expenditures/${id}`, method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<null>) => unwrapData(response),
            invalidatesTags: ['MiscExpenditures']
        })
    })
})

export const {
    useGetMiscExpendituresQuery,
    useGetMiscExpenditureCategoriesQuery,
    useCreateMiscExpenditureCategoryMutation,
    useUpdateMiscExpenditureCategoryMutation,
    useDeleteMiscExpenditureCategoryMutation,
    useCreateMiscExpenditureMutation,
    useDeleteMiscExpenditureMutation
} = miscExpenditureApi
