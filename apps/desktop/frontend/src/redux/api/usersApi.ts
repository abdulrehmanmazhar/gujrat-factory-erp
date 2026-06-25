import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, CustomerTransaction, SupplierTransaction, User } from '@/types/api'

export const usersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getUsers: builder.query<{ users: User[] }, void>({
            queryFn: createListQueryFn('/get-all-users-admin', { users: [] }),
            providesTags: ['Users']
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
        })
    })
})

export const analyticsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getSales: builder.mutation<{ sales: unknown[]; type?: string }, { dateRange: string; type?: string; startDate?: string; endDate?: string }>({
            query: (body) => ({ url: '/get-sales', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ sales: unknown[]; type?: string }>) => unwrapData(response)
        }),
        getRecentTransactions: builder.query<
            { customerTransactions: CustomerTransaction[]; supplierTransactions: SupplierTransaction[] },
            number | void
        >({
            query: (limit = 10) => ({
                url: '/recent-transactions',
                params: { limit }
            }),
            transformResponse: (
                response: ApiEnvelope<{
                    customerTransactions: CustomerTransaction[]
                    supplierTransactions: SupplierTransaction[]
                }>
            ) => unwrapData(response),
            providesTags: ['CustomerTransactions', 'SupplierTransactions']
        })
    })
})

export const { useGetUsersQuery, useDeleteUserMutation, useUpdateUserRoleMutation, useVerifyUserMutation } = usersApi
export const { useGetSalesMutation, useGetRecentTransactionsQuery } = analyticsApi
