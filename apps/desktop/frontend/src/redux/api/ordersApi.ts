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
        addOrderPayment: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; payment: number }>({
            query: ({ id, payment }) => ({
                url: `/add-order-payment/${id}`,
                method: 'POST',
                body: { payment }
            }),
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
        returnOrder: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; refundAmount: number }>({
            query: ({ id, refundAmount }) => ({
                url: `/return-order/${id}`,
                method: 'POST',
                body: { refundAmount }
            }),
            invalidatesTags: [...ORDER_MUTATION_TAGS]
        }),
        recordOrderRefund: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; refundAmount: number; notes?: string }>({
            query: ({ id, refundAmount, notes }) => ({
                url: `/add-order-refund/${id}`,
                method: 'POST',
                body: { refundAmount, notes }
            }),
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
                orderMode?: 'pos' | 'delayed'
                payment?: number
            }
        >({
            query: ({ customerId, cart, deliveryDate, message, additionalDiscount, orderMode, payment }) => ({
                url: `/create-order/${customerId}`,
                method: 'POST',
                body: {
                    cart,
                    deliveryDate,
                    message,
                    additionalDiscount: additionalDiscount ?? 0,
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
    useAddOrderPaymentMutation,
    useReturnOrderUdharMutation,
    useReturnOrderMutation,
    useRecordOrderRefundMutation,
    useFillCartMutation,
    useCreateOrderMutation,
    useDeleteCartItemMutation,
    useGenerateInvoicesMutation
} = ordersApi
