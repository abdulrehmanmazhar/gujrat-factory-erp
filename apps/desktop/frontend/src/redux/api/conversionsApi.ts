import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, ProductConversion } from '@/types/api'

export type CreateConversionBody = {
    inputProductId: string
    outputProductId: string
    inputRatio: number
    outputRatio: number
    inputQty?: number
    outputQty?: number
    notes?: string
}

export const conversionsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getConversions: builder.query<{ conversions: ProductConversion[] }, void>({
            query: () => '/conversions',
            transformResponse: (response: ApiEnvelope<{ conversions: ProductConversion[] }>) => unwrapData(response),
            providesTags: ['Conversions']
        }),
        createConversion: builder.mutation<{ conversion: ProductConversion }, CreateConversionBody>({
            query: (body) => ({ url: '/conversions', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ conversion: ProductConversion }>) => unwrapData(response),
            invalidatesTags: ['Conversions', 'Products']
        }),
        undoConversion: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/conversions/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Conversions', 'Products']
        })
    })
})

export const { useGetConversionsQuery, useCreateConversionMutation, useUndoConversionMutation } = conversionsApi
