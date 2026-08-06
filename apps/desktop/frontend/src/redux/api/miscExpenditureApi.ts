import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, MiscellaneousExpenditure } from '@/types/api'

export type CreateMiscExpenditureInput = {
    amount: number
    paymentMode: 'cash' | 'online'
    note: string
    proofImage?: File | null
}

export const miscExpenditureApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getMiscExpenditures: builder.query<{ expenditures: MiscellaneousExpenditure[] }, void>({
            query: () => '/miscellaneous-expenditures',
            transformResponse: (response: ApiEnvelope<{ expenditures: MiscellaneousExpenditure[] }>) => unwrapData(response),
            providesTags: ['MiscExpenditures']
        }),
        createMiscExpenditure: builder.mutation<{ expenditure: MiscellaneousExpenditure }, CreateMiscExpenditureInput>({
            query: ({ amount, paymentMode, note, proofImage }) => {
                const body = new FormData()
                body.append('amount', String(amount))
                body.append('paymentMode', paymentMode)
                body.append('note', note)
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

export const { useGetMiscExpendituresQuery, useCreateMiscExpenditureMutation, useDeleteMiscExpenditureMutation } = miscExpenditureApi
