import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Target, User } from '@/types/api'

export const usersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getUsers: builder.query<{ users: User[] }, void>({
            queryFn: createListQueryFn('/get-all-users-admin', { users: [] }),
            providesTags: ['Users']
        }),
        addUser: builder.mutation<ApiEnvelope<null>, { name: string; email: string; password: string }>({
            query: (body) => ({ url: '/add-user-admin', method: 'POST', body }),
            invalidatesTags: ['Users']
        }),
        deleteUser: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-user/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Users']
        }),
        updateUserRole: builder.mutation<ApiEnvelope<{ user: User }>, { id: string; role: string }>({
            query: (body) => ({ url: '/update-user-role', method: 'PUT', body }),
            invalidatesTags: ['Users']
        }),
        verifyUser: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/verify-user/${id}`, method: 'PUT' }),
            invalidatesTags: ['Users']
        }),
        assignRoute: builder.mutation<ApiEnvelope<null>, { id: string; route: string }>({
            query: ({ id, route }) => ({ url: `/assign-route/${id}`, method: 'PUT', body: { route } }),
            invalidatesTags: ['Users']
        })
    })
})

export const targetsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getTargets: builder.query<{ targets: Target[]; count: number }, void>({
            queryFn: createListQueryFn('/gell-all-targets', { targets: [], count: 0 }),
            providesTags: ['Targets']
        }),
        createTarget: builder.mutation<
            ApiEnvelope<{ target: Target }>,
            { userId: string; type: string; value: number; productId?: string; startDate: string; endDate: string }
        >({
            query: ({ userId, ...body }) => ({
                url: `/create-target/${userId}`,
                method: 'POST',
                body
            }),
            invalidatesTags: ['Targets']
        }),
        deleteTarget: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-target/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Targets']
        })
    })
})

export const analyticsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getSales: builder.mutation<{ sales: unknown[]; type?: string }, { dateRange: string; type?: string; startDate?: string; endDate?: string }>({
            query: (body) => ({ url: '/get-sales', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ sales: unknown[]; type?: string }>) => unwrapData(response)
        })
    })
})

export const {
    useGetUsersQuery,
    useAddUserMutation,
    useDeleteUserMutation,
    useUpdateUserRoleMutation,
    useVerifyUserMutation,
    useAssignRouteMutation
} = usersApi

export const { useGetTargetsQuery, useCreateTargetMutation, useDeleteTargetMutation } = targetsApi
export const { useGetSalesMutation } = analyticsApi
