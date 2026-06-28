import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import constants from '@/constants/app'
import { getStoredDocumentLanguage } from '@/lib/i18n-storage'
import { logout, setCredentials } from '@/redux/slices/authSlice'
import type { RootState } from '@/redux/store'

const baseQuery = fetchBaseQuery({
    baseUrl: constants.API_BASE,
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
        const token = (getState() as RootState).auth.token
        if (token) {
            headers.set('Authorization', `Bearer ${token}`)
        }
        headers.set('X-Document-Language', getStoredDocumentLanguage())
        return headers
    }
})

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions)

    if (result.error?.status === 401) {
        const refreshResult = await baseQuery('/refresh', api, extraOptions)
        if (refreshResult.data) {
            const user = (api.getState() as RootState).auth.user
            const data = refreshResult.data as { accessToken?: string; status?: string }
            if (user && data.accessToken) {
                api.dispatch(setCredentials({ user, accessToken: data.accessToken }))
            }
            result = await baseQuery(args, api, extraOptions)
        } else {
            api.dispatch(logout())
        }
    }

    return result
}

export const apiSlice = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithReauth,
    tagTypes: [
        'Customers',
        'Products',
        'Orders',
        'Users',
        'CustomerTransactions',
        'SupplierTransactions',
        'Me',
        'Suppliers',
        'WhatsApp',
        'RestockOrders',
        'Recipes',
        'Labourers',
        'LabourProduction',
        'LabourerTransactions',
        'Settings',
        'Analytics'
    ],
    endpoints: () => ({})
})
