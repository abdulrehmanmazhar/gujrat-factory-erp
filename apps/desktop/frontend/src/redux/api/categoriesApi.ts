import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Category } from '@/types/api'

export const categoriesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCategories: builder.query<{ categories: Category[] }, void>({
            queryFn: createListQueryFn('/categories', { categories: [] }),
            providesTags: ['Categories'],
            keepUnusedDataFor: 30
        }),
        createCategory: builder.mutation<{ category: Category }, { name: string; parentId?: string | null; sortOrder?: number }>({
            query: (body) => ({ url: '/categories', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ category: Category }>) => unwrapData(response),
            invalidatesTags: ['Categories', 'Products']
        }),
        updateCategory: builder.mutation<{ category: Category }, { id: string; name?: string; parentId?: string | null; sortOrder?: number }>({
            query: ({ id, ...body }) => ({ url: `/categories/${id}`, method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<{ category: Category }>) => unwrapData(response),
            invalidatesTags: ['Categories', 'Products']
        }),
        deleteCategory: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/categories/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Categories', 'Products']
        })
    })
})

export const { useGetCategoriesQuery, useCreateCategoryMutation, useUpdateCategoryMutation, useDeleteCategoryMutation } = categoriesApi
