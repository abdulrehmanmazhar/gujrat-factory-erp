import { apiSlice } from '@/redux/api/apiSlice'
import { createListQueryFn, unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, Customer } from '@/types/api'

export const customersApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getCustomers: builder.query<{ customers: Customer[] }, void>({
            queryFn: createListQueryFn('/get-customers', { customers: [] }),
            providesTags: ['Customers'],
            keepUnusedDataFor: 30
        }),
        addCustomer: builder.mutation<{ customer: Customer }, Partial<Customer>>({
            query: (body) => ({ url: '/add-customer', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<{ customer: Customer }>) => unwrapData(response),
            invalidatesTags: ['Customers']
        }),
        editCustomer: builder.mutation<{ customer: Customer }, Partial<Customer> & { id: string }>({
            query: ({ id, ...body }) => ({ url: `/edit-customer/${id}`, method: 'PUT', body }),
            transformResponse: (response: ApiEnvelope<{ customer: Customer }>) => unwrapData(response),
            invalidatesTags: ['Customers']
        }),
        deleteCustomer: builder.mutation<ApiEnvelope<null>, string>({
            query: (id) => ({ url: `/delete-customer/${id}`, method: 'DELETE' }),
            invalidatesTags: ['Customers']
        }),
        returnUdhar: builder.mutation<{ udhar: number }, { id: string; returnUdhar: number }>({
            query: ({ id, returnUdhar }) => ({
                url: `/returnUdhar/${id}`,
                method: 'PUT',
                body: { returnUdhar }
            }),
            transformResponse: (response: ApiEnvelope<{ udhar: number }>) => unwrapData(response),
            invalidatesTags: ['Customers', 'Orders']
        })
    })
})

export const { useGetCustomersQuery, useAddCustomerMutation, useEditCustomerMutation, useDeleteCustomerMutation, useReturnUdharMutation } =
    customersApi

export { unwrapData }
