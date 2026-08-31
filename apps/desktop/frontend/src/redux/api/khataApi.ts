import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, KhataDirection, KhataEntry, KhataParty } from '@/types/api'

export type CreateKhataEntryInput = {
    partyId: string
    direction: KhataDirection
    amount: number
    description?: string
    paymentMode: 'cash' | 'online'
    proofImage?: File | null
}

export const khataApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCustomerKhata: builder.query<{ entries: KhataEntry[] }, void>({
            query: () => '/khata/customers',
            transformResponse: (response: ApiEnvelope<{ entries: KhataEntry[] }>) => unwrapData(response),
            providesTags: ['Khata']
        }),
        getSupplierKhata: builder.query<{ entries: KhataEntry[] }, void>({
            query: () => '/khata/suppliers',
            transformResponse: (response: ApiEnvelope<{ entries: KhataEntry[] }>) => unwrapData(response),
            providesTags: ['Khata']
        }),
        createCustomerKhata: builder.mutation<{ entry: KhataEntry }, CreateKhataEntryInput>({
            query: ({ partyId, direction, amount, description, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('customerId', partyId)
                body.append('direction', direction)
                body.append('amount', String(amount))
                body.append('paymentMode', paymentMode)
                if (description) body.append('description', description)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: '/khata/customers', method: 'POST', body }
            },
            transformResponse: (response: ApiEnvelope<{ entry: KhataEntry }>) => unwrapData(response),
            invalidatesTags: ['Khata', 'Customers', 'CustomerTransactions', 'Analytics']
        }),
        createSupplierKhata: builder.mutation<{ entry: KhataEntry }, CreateKhataEntryInput>({
            query: ({ partyId, direction, amount, description, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('supplierId', partyId)
                body.append('direction', direction)
                body.append('amount', String(amount))
                body.append('paymentMode', paymentMode)
                if (description) body.append('description', description)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: '/khata/suppliers', method: 'POST', body }
            },
            transformResponse: (response: ApiEnvelope<{ entry: KhataEntry }>) => unwrapData(response),
            invalidatesTags: ['Khata', 'Suppliers', 'SupplierTransactions', 'Analytics']
        }),
        deleteKhataEntry: builder.mutation<null, { party: KhataParty; id: string }>({
            query: ({ party, id }) => ({ url: `/khata/${party}/${id}`, method: 'DELETE' }),
            transformResponse: (response: ApiEnvelope<null>) => unwrapData(response),
            invalidatesTags: ['Khata', 'Customers', 'Suppliers', 'CustomerTransactions', 'SupplierTransactions', 'Analytics']
        })
    })
})

export const {
    useGetCustomerKhataQuery,
    useGetSupplierKhataQuery,
    useCreateCustomerKhataMutation,
    useCreateSupplierKhataMutation,
    useDeleteKhataEntryMutation
} = khataApi
