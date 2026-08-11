import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Product, Unit } from '@/types/api'

export const productsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getProducts: builder.query<{ products: Product[] }, void>({
            queryFn: createListQueryFn('/get-products', { products: [] }),
            providesTags: ['Products'],
            keepUnusedDataFor: 30
        }),
        getUnits: builder.query<{ units: Unit[] }, void>({
            queryFn: createListQueryFn('/units', { units: [] }),
            providesTags: ['Units']
        }),
        createUnit: builder.mutation<{ unit: Unit }, { name: string }>({
            query: (body) => ({ url: '/units', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ unit: Unit }>) => unwrapData(response),
            invalidatesTags: ['Units']
        }),
        addProduct: builder.mutation<
            ApiEnvelope<{ createdProduct: Product }>,
            {
                name: string
                category?: string
                categoryIds?: string[]
                price: number
                stockQty: number
                totalBill: number
                discount?: number
                unitId: string
            }
        >({
            query: (body) => ({ url: '/add-product', method: 'POST', body }),
            invalidatesTags: ['Products', 'Categories']
        }),
        editProduct: builder.mutation<
            ApiEnvelope<{ editedOne: Product }>,
            {
                id: string
                name: string
                category?: string
                categoryIds?: string[]
                price: number
                unitId: string
            }
        >({
            query: ({ id, ...body }) => ({ url: `/edit-product/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Products', 'Categories']
        }),
        restockProduct: builder.mutation<
            ApiEnvelope<{ editedOne: Product }>,
            { id: string; price: number; stockQty: number; totalBill: number; discount?: number }
        >({
            query: ({ id, ...body }) => ({ url: `/restock-product/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Products', 'Categories']
        }),
        deleteProduct: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-product/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Products', 'Categories']
        })
    })
})

export const {
    useGetProductsQuery,
    useGetUnitsQuery,
    useCreateUnitMutation,
    useAddProductMutation,
    useEditProductMutation,
    useRestockProductMutation,
    useDeleteProductMutation
} = productsApi
