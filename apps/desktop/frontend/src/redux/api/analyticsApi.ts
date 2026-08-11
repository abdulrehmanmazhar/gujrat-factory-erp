import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type { ApiEnvelope } from '@/types/api'
import constants from '@/constants/app'

export type ChartPoint = { date: string; total: number }

export type HomeAnalytics = {
    revenue: { series: ChartPoint[]; total: number }
    labour: { series: ChartPoint[]; total: number }
    expenses: { series: ChartPoint[]; total: number; breakdown: { supplier: number; labour: number } }
    stock: { series: ChartPoint[]; totalInbound: number; currentStockTotal: number }
}

export type StockVsPendingProduct = {
    productId: string
    name: string
    category: string
    currentStock: number
    pendingQty: number
    surplus: number
}

export const analyticsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getHomeAnalytics: builder.query<HomeAnalytics, { startDate: string; endDate: string }>({
            query: ({ startDate, endDate }) => `/analytics/home?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
            transformResponse: (response: ApiEnvelope<HomeAnalytics>) => unwrapData(response),
            providesTags: ['Analytics']
        }),
        getUpcomingDeliveries: builder.query<{ orders: Record<string, unknown>[] }, number | void>({
            query: (days = 14) => `/dashboard/upcoming-deliveries?days=${days}`,
            transformResponse: (response: ApiEnvelope<{ orders: Record<string, unknown>[] }>) => unwrapData(response),
            providesTags: ['Orders']
        }),
        getStockVsPending: builder.query<{ products: StockVsPendingProduct[] }, void>({
            query: () => '/dashboard/stock-vs-pending',
            transformResponse: (response: ApiEnvelope<{ products: StockVsPendingProduct[] }>) => unwrapData(response),
            providesTags: ['Orders', 'Products']
        }),
        postponeDelivery: builder.mutation<ApiEnvelope<{ order: Record<string, unknown> }>, { id: string; deliveryDate: string }>({
            query: ({ id, deliveryDate }) => ({
                url: `/orders/${id}/postpone-delivery`,
                method: 'PUT',
                body: { deliveryDate }
            }),
            invalidatesTags: ['Orders', 'Products', 'Categories', 'Analytics']
        })
    })
})

export const { useGetHomeAnalyticsQuery, useGetUpcomingDeliveriesQuery, useGetStockVsPendingQuery, usePostponeDeliveryMutation } = analyticsApi

export async function downloadAnalyticsExcel(report: string, startDate: string, endDate: string, getToken: () => string | null) {
    const token = getToken()
    const url = `${constants.API_BASE}/analytics/export?report=${encodeURIComponent(report)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`

    const response = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })

    if (!response.ok) throw new Error('Export failed')

    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${report}-${startDate.slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(link.href)
}
