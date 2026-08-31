import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, RestockOrder } from '@/types/api'

export const RESTOCK_MUTATION_TAGS = ['RestockOrders', 'Products', 'Categories', 'Suppliers', 'SupplierTransactions', 'Analytics'] as const

type RestockItemInput = { productId: string; qtyOrdered: number; unitCost: number }

export const restockApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getRestockOrders: builder.query<{ orders: RestockOrder[] }, string | void>({
            query: (status) => ({
                url: '/restock-orders',
                params: status ? { status } : undefined
            }),
            transformResponse: (response: ApiEnvelope<{ orders: RestockOrder[] }>) => unwrapData(response),
            providesTags: ['RestockOrders']
        }),
        getRestockOrder: builder.query<{ order: RestockOrder }, string>({
            query: (id) => `/restock-orders/${id}`,
            transformResponse: (response: ApiEnvelope<{ order: RestockOrder }>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'RestockOrders', id }]
        }),
        createRestockOrder: builder.mutation<
            ApiEnvelope<{ order: RestockOrder }>,
            {
                supplierId: string
                items: RestockItemInput[]
                notes?: string
                referenceNumber?: string
            }
        >({
            query: (body) => ({ url: '/restock-orders', method: 'POST', body }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        addRestockOrderItem: builder.mutation<
            ApiEnvelope<{ order: RestockOrder }>,
            { orderId: string; productId: string; qtyOrdered: number; unitCost: number }
        >({
            query: ({ orderId, ...body }) => ({
                url: `/restock-orders/${orderId}/items`,
                method: 'POST',
                body
            }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        markRestockOrdered: builder.mutation<ApiEnvelope<{ order: RestockOrder }>, string>({
            query: (id) => ({ url: `/restock-orders/${id}/order`, method: 'POST' }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        receiveRestockOrder: builder.mutation<
            ApiEnvelope<{ order: RestockOrder }>,
            { id: string; receivedItems?: { itemId: string; qtyReceived: number }[] }
        >({
            query: ({ id, receivedItems }) => ({
                url: `/restock-orders/${id}/receive`,
                method: 'POST',
                body: receivedItems ? { receivedItems } : {}
            }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        cancelRestockOrder: builder.mutation<ApiEnvelope<{ order: RestockOrder }>, string>({
            query: (id) => ({ url: `/restock-orders/${id}/cancel`, method: 'POST' }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        deleteRestockOrder: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/restock-orders/${id}`, method: 'DELETE' }),
            invalidatesTags: ['RestockOrders', 'Analytics']
        }),
        recordRestockPayment: builder.mutation<
            ApiEnvelope<{ order: RestockOrder }>,
            { id: string; amount: number; notes?: string; paymentMode: 'cash' | 'online'; proofImage?: File | null }
        >({
            query: ({ id, amount, notes, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('amount', String(amount))
                body.append('paymentMode', paymentMode)
                if (notes) body.append('notes', notes)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: `/restock-orders/${id}/payments`, method: 'POST', body }
            },
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        recordRestockRefund: builder.mutation<
            ApiEnvelope<{ order: RestockOrder }>,
            {
                id: string
                returnedItems: { itemId: string; qtyReturned: number }[]
                amount?: number
                notes?: string
                paymentMode: 'cash' | 'online'
                proofImage?: File | null
            }
        >({
            query: ({ id, amount, notes, returnedItems, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('returnedItems', JSON.stringify(returnedItems))
                body.append('paymentMode', paymentMode)
                if (amount !== undefined) body.append('amount', String(amount))
                if (notes) body.append('notes', notes)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: `/restock-orders/${id}/refunds`, method: 'POST', body }
            },
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        }),
        deleteSupplierTransaction: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/supplier/transactions/${id}`, method: 'DELETE' }),
            invalidatesTags: [...RESTOCK_MUTATION_TAGS]
        })
    })
})

export const {
    useGetRestockOrdersQuery,
    useGetRestockOrderQuery,
    useCreateRestockOrderMutation,
    useAddRestockOrderItemMutation,
    useMarkRestockOrderedMutation,
    useReceiveRestockOrderMutation,
    useCancelRestockOrderMutation,
    useDeleteRestockOrderMutation,
    useRecordRestockPaymentMutation,
    useRecordRestockRefundMutation,
    useDeleteSupplierTransactionMutation
} = restockApi
