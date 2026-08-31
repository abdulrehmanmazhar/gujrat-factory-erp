import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Supplier } from '@/types/api'

export const suppliersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getSuppliers: builder.query<{ suppliers: Supplier[] }, void>({
            query: () => '/suppliers',
            transformResponse: (response: ApiEnvelope<{ suppliers: Supplier[] }>) => unwrapData(response),
            providesTags: ['Suppliers']
        }),
        getSupplier: builder.query<{ supplier: Supplier }, string>({
            query: (id) => `/suppliers/${id}`,
            transformResponse: (response: ApiEnvelope<{ supplier: Supplier }>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Suppliers', id }]
        }),
        createSupplier: builder.mutation<
            ApiEnvelope<{ supplier: Supplier }>,
            { name: string; contact: string; businessName?: string; address?: string; notes?: string }
        >({
            query: (body) => ({ url: '/suppliers', method: 'POST', body }),
            invalidatesTags: ['Suppliers', 'Analytics']
        }),
        updateSupplier: builder.mutation<
            ApiEnvelope<{ supplier: Supplier }>,
            { id: string; name?: string; contact?: string; businessName?: string; address?: string; notes?: string }
        >({
            query: ({ id, ...body }) => ({ url: `/suppliers/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Suppliers', 'Analytics']
        }),
        deleteSupplier: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/suppliers/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Suppliers', 'Analytics']
        }),
        linkSupplierProduct: builder.mutation<
            ApiEnvelope<null>,
            { supplierId: string; productId: string; supplierSku?: string; unitCost?: number; isPreferred?: boolean }
        >({
            query: ({ supplierId, ...body }) => ({
                url: `/suppliers/${supplierId}/products`,
                method: 'POST',
                body
            }),
            invalidatesTags: ['Suppliers', 'Products']
        }),
        linkSupplierProductsByCategories: builder.mutation<
            ApiEnvelope<{ linked: number; productIds: string[] }>,
            { supplierId: string; categoryIds: string[]; supplierSku?: string; unitCost?: number; isPreferred?: boolean }
        >({
            query: ({ supplierId, ...body }) => ({
                url: `/suppliers/${supplierId}/products/by-categories`,
                method: 'POST',
                body
            }),
            invalidatesTags: ['Suppliers', 'Products']
        }),
        unlinkSupplierProduct: builder.mutation<ApiEnvelope<null>, { supplierId: string; productId: string }>({
            query: ({ supplierId, productId }) => ({
                url: `/suppliers/${supplierId}/products/${productId}`,
                method: 'DELETE'
            }),
            invalidatesTags: ['Suppliers', 'Products']
        })
    })
})

export const {
    useGetSuppliersQuery,
    useGetSupplierQuery,
    useCreateSupplierMutation,
    useUpdateSupplierMutation,
    useDeleteSupplierMutation,
    useLinkSupplierProductMutation,
    useLinkSupplierProductsByCategoriesMutation,
    useUnlinkSupplierProductMutation
} = suppliersApi
