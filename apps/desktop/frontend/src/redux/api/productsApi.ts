import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn } from '@/lib/api-helpers'
import type { ApiEnvelope, Product } from '@/types/api'

export const productsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getProducts: builder.query<{ products: Product[] }, void>({
            queryFn: createListQueryFn('/get-products', { products: [] }),
            providesTags: ['Products'],
            keepUnusedDataFor: 30
        }),
        addProduct: builder.mutation<
            ApiEnvelope<{ createdProduct: Product }>,
            { name: string; category: string; price: number; stockQty: number; totalBill: number; discount?: number }
        >({
            query: (body) => ({ url: '/add-product', method: 'POST', body }),
            invalidatesTags: ['Products']
        }),
        editProduct: builder.mutation<
            ApiEnvelope<{ editedOne: Product }>,
            { id: string; name: string; category: string; price: number; stockQty: number }
        >({
            query: ({ id, ...body }) => ({ url: `/edit-product/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Products']
        }),
        restockProduct: builder.mutation<
            ApiEnvelope<{ editedOne: Product }>,
            { id: string; price: number; stockQty: number; totalBill: number; discount?: number }
        >({
            query: ({ id, ...body }) => ({ url: `/restock-product/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Products']
        }),
        deleteProduct: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-product/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Products']
        })
    })
})

export const { useGetProductsQuery, useAddProductMutation, useEditProductMutation, useRestockProductMutation, useDeleteProductMutation } = productsApi
