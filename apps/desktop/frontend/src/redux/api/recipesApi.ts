import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Recipe } from '@/types/api'

export const recipesApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getRecipes: builder.query<{ recipes: Recipe[] }, void>({
            query: () => '/recipes',
            transformResponse: (response: ApiEnvelope<{ recipes: Recipe[] }>) => unwrapData(response),
            providesTags: ['Recipes']
        }),
        getRecipe: builder.query<{ recipe: Recipe }, string>({
            query: (id) => `/recipes/${id}`,
            transformResponse: (response: ApiEnvelope<{ recipe: Recipe }>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Recipes', id }]
        }),
        createRecipe: builder.mutation<
            ApiEnvelope<{ recipe: Recipe }>,
            { outputProductId: string; items: { ingredientProductId: string; qty: number }[]; notes?: string }
        >({
            query: (body) => ({ url: '/recipes', method: 'POST', body }),
            invalidatesTags: ['Recipes']
        }),
        updateRecipe: builder.mutation<
            ApiEnvelope<{ recipe: Recipe }>,
            { id: string; items: { ingredientProductId: string; qty: number }[]; notes?: string }
        >({
            query: ({ id, ...body }) => ({ url: `/recipes/${id}`, method: 'PUT', body }),
            invalidatesTags: ['Recipes']
        }),
        deleteRecipe: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/recipes/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Recipes']
        })
    })
})

export const { useGetRecipesQuery, useGetRecipeQuery, useCreateRecipeMutation, useUpdateRecipeMutation, useDeleteRecipeMutation } = recipesApi
