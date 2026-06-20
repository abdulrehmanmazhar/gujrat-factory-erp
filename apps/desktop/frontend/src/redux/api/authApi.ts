import { apiSlice } from '@/redux/api/apiSlice'
import { logout, setCredentials } from '@/redux/slices/authSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope, LoginResponse, RegistrationResponse, User } from '@/types/api'

export const authApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation<LoginResponse, { email: string; password: string }>({
            query: (body) => ({ url: '/login', method: 'POST', body }),
            async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
                try {
                    const { data } = await queryFulfilled
                    dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }))
                } catch {
                    /* handled in UI */
                }
            }
        }),
        register: builder.mutation<RegistrationResponse, { name: string; email: string; password: string }>({
            query: (body) => ({ url: '/registration', method: 'POST', body }),
            transformResponse: (response: ApiEnvelope<RegistrationResponse>) => unwrapData(response)
        }),
        activateUser: builder.mutation<ApiEnvelope<null>, { activation_token: string; activation_code: string }>({
            query: (body) => ({ url: '/activate-user', method: 'POST', body })
        }),
        logout: builder.mutation<ApiEnvelope<null>, void>({
            query: () => ({ url: '/logout', method: 'POST' }),
            async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
                try {
                    await queryFulfilled
                } finally {
                    dispatch(logout())
                }
            }
        }),
        getMe: builder.query<{ user: User }, void>({
            query: () => '/me',
            transformResponse: (response: ApiEnvelope<{ user: User }>) => unwrapData(response),
            providesTags: ['Me'],
            async onQueryStarted(_arg, { queryFulfilled, dispatch }) {
                try {
                    const { data } = await queryFulfilled
                    dispatch(setCredentials({ user: data.user }))
                } catch {
                    dispatch(logout())
                }
            }
        })
    })
})

export const { useLoginMutation, useRegisterMutation, useActivateUserMutation, useLogoutMutation, useGetMeQuery, useLazyGetMeQuery } = authApi
