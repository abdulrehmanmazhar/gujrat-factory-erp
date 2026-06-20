import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Order } from '@/types/api'

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
        deleteOrder: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-order/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Orders']
        }),
        addOrderPayment: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; payment: number }>({
            query: ({ id, payment }) => ({
                url: `/add-order-payment/${id}`,
                method: 'POST',
                body: { payment }
            }),
            invalidatesTags: ['Orders']
        }),
        returnOrderUdhar: builder.mutation<ApiEnvelope<{ order: Order }>, { id: string; payment: number }>({
            query: ({ id, payment }) => ({
                url: `/return-order-udhar/${id}`,
                method: 'POST',
                body: { payment }
            }),
            invalidatesTags: ['Orders', 'Customers']
        }),
        fillCart: builder.mutation<ApiEnvelope<{ order: Order }>, { customerId: string; cart: { productId: string; qty: number }[] }>({
            query: ({ customerId, cart }) => ({
                url: `/fill-cart/${customerId}`,
                method: 'POST',
                body: { cart }
            }),
            invalidatesTags: ['Orders', 'Products']
        }),
        createOrder: builder.mutation<
            ApiEnvelope<null>,
            {
                customerId: string
                cart: { productId: string; qty: number }[]
                deliveryDate: string
                message?: string
                additionalDiscount?: number
            }
        >({
            query: ({ customerId, cart, deliveryDate, message, additionalDiscount }) => ({
                url: `/create-order/${customerId}`,
                method: 'POST',
                body: { cart, deliveryDate, message, additionalDiscount: additionalDiscount ?? 0 }
            }),
            invalidatesTags: ['Orders', 'Products', 'Customers']
        }),
        deleteCartItem: builder.mutation<ApiEnvelope<null>, { orderId: string; index: number }>({
            query: ({ orderId, index }) => ({
                url: `/delete-cart/${orderId}/${index}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Orders', 'Products']
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
    useDeleteOrderMutation,
    useAddOrderPaymentMutation,
    useReturnOrderUdharMutation,
    useFillCartMutation,
    useCreateOrderMutation,
    useDeleteCartItemMutation,
    useGenerateInvoicesMutation
} = ordersApi
