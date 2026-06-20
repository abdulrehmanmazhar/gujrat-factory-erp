import type { ApiEnvelope } from '@/types/api'
import type { BaseQueryApi, FetchBaseQueryError, QueryReturnValue } from '@reduxjs/toolkit/query'

export function unwrapData<T>(response: ApiEnvelope<T> | T): T {
    if (response && typeof response === 'object' && 'data' in response) {
        return (response as ApiEnvelope<T>).data
    }
    return response as T
}

type ListBaseQuery = (arg: string) => Promise<QueryReturnValue<unknown, FetchBaseQueryError, object>>

export function createListQueryFn<T>(url: string, empty: T) {
    return async (
        _arg: void,
        _api: BaseQueryApi,
        _extra: object,
        baseQuery: ListBaseQuery
    ): Promise<QueryReturnValue<T, FetchBaseQueryError, object>> => {
        const result = await baseQuery(url)
        if (result.error?.status === 404) {
            return { data: empty }
        }
        if (result.data) {
            return { data: unwrapData<T>(result.data as ApiEnvelope<T>) }
        }
        return result as QueryReturnValue<T, FetchBaseQueryError, object>
    }
}
