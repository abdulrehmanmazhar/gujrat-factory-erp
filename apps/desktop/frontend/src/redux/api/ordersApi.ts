import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Order } from '@/types/api'

/** Any order mutation that can change product stock or customer balances. */
export const ORDER_MUTATION_TAGS = ['Orders', 'Products', 'Customers', 'CustomerTransactions'] as const

export const ordersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getOrders: builder.query<{ orders: Order[] }, void>({
            queryFn: createListQueryFn('/get-orders', { orders: [] }),
            providesTags: ['Orders']
        }),
        getOrder: builder.query<{ order: Order }, string>({
            query: (id) => `/get-order/${id}`,
            transformResponse: (response: ApiEnvelope<{ order: Order }>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Orders', id }]
        }),
        cancelOrder: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; refundAmount: number }>({
            query: ({ id, refundAmount }) => ({
                url: `/cancel-order/${id}`,
                method: 'POST',
                body: { refundAmount }
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        deleteOrder: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({
                url: `/delete-order/${id}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Orders']
        }),
        addOrderPayment: builder.mutation<
            ApiEnvelope<{ order: Order }>,
            { id: string; payment: number; paymentMode: 'cash' | 'online'; proofImage?: File | null }
        >({
            query: ({ id, payment, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('payment', String(payment))
                body.append('paymentMode', paymentMode)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: `/add-order-payment/${id}`, method: 'POST', body }
            },
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        returnOrderUdhar: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; payment: number }>({
            query: ({ id, payment }) => ({
                url: `/return-order-udhar/${id}`,
                method: 'POST',
                body: { payment }
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        returnOrder: builder.mutation<
            ApiEnvelope<{ order: Order }>,
            { id: string; refundAmount: number; paymentMode: 'cash' | 'online'; proofImage?: File | null }
        >({
            query: ({ id, refundAmount, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('refundAmount', String(refundAmount))
                body.append('paymentMode', paymentMode)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: `/return-order/${id}`, method: 'POST', body }
            },
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        recordOrderRefund: builder.mutation<
            ApiEnvelope<{ order: Order }>,
            { id: string; refundAmount: number; notes?: string; paymentMode: 'cash' | 'online'; proofImage?: File | null }
        >({
            query: ({ id, refundAmount, notes, paymentMode, proofImage }) => {
                const body = new FormData()
                body.append('refundAmount', String(refundAmount))
                body.append('paymentMode', paymentMode)
                if (notes) body.append('notes', notes)
                if (proofImage) body.append('proofImage', proofImage)
                return { url: `/add-order-refund/${id}`, method: 'POST', body }
            },
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        fillCart: builder.mutation<ApiEnvelope<{ order: Order }>, { customerId: string; cart: { productId: string; qty: number }[] }>({
            query: ({ customerId, cart }) => ({
                url: `/fill-cart/${customerId}`,
                method: 'POST',
                body: { cart }
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        createOrder: builder.mutation<
            ApiEnvelope<null>,
            {
                customerId: string
                cart: { productId: string; qty: number }[]
                deliveryDate: string
                message?: string
                additionalDiscount?: number
                additionalDiscounts?: { description: string; amount: number }[]
                additionalCharges?: { description: string; amount: number }[]
                invoiceBreakdown?: boolean
                orderMode?: 'pos' | 'delayed'
                payment?: number
            }
        >({
            query: ({
                customerId,
                cart,
                deliveryDate,
                message,
                additionalDiscount,
                additionalDiscounts,
                additionalCharges,
                invoiceBreakdown,
                orderMode,
                payment
            }) => ({
                url: `/create-order/${customerId}`,
                method: 'POST',
                body: {
                    cart,
                    deliveryDate,
                    message,
                    additionalDiscount: additionalDiscount ?? 0,
                    additionalDiscounts: additionalDiscounts ?? [],
                    additionalCharges: additionalCharges ?? [],
                    invoiceBreakdown: invoiceBreakdown ?? true,
                    orderMode: orderMode ?? 'delayed',
                    payment: payment ?? 0
                }
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        deleteCartItem: builder.mutation<ApiEnvelope<null>, { orderId: string; index: number }>({
            query: ({ orderId, index }) => ({
                url: `/delete-cart/${orderId}/${index}`,
                method: 'DELETE'
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        generateInvoices: builder.mutation<Blob, { orderIds: string[] }>({
            query: (body) => ({
                url: '/generate-invoices',
                method: 'POST',
                body,
                responseHandler: (response) => response.blob()
            })
        })
    })
})

export const {
    useGetOrdersQuery,
    useGetOrderQuery,
    useCancelOrderMutation,
    useDeleteOrderMutation,
    useAddOrderPaymentMutation,
    useReturnOrderUdharMutation,
    useReturnOrderMutation,
    useRecordOrderRefundMutation,
    useFillCartMutation,
    useCreateOrderMutation,
    useDeleteCartItemMutation,
    useGenerateInvoicesMutation
} = ordersApi
