import { apiSlice } from '@/redux/api/apiSlice'
import { unwrapData } from '@/lib/api-helpers'
import type {
    ApiEnvelope,
    CustomerAnalyticsDetail,
    CustomerAnalyticsRow,
    InventoryCustomerRow,
    InventoryLabourRow,
    InventorySupplierRow,
    LabourAnalyticsDetail,
    LabourAnalyticsRow,
    SupplierAnalyticsDetail,
    SupplierAnalyticsRow
} from '@/types/api'
import constants from '@/constants/app'

export type ChartPoint = { date: string; total: number }

export type HomeAnalytics = {
    profitLoss: {
        series: ChartPoint[]
        total: number
        breakdown: { revenue: number; cogs: number; labour: number; misc: number }
    }
    sales: { series: ChartPoint[]; total: number }
    cogs: { series: ChartPoint[]; total: number }
    labourCost: { series: ChartPoint[]; total: number }
    miscCost: { series: ChartPoint[]; total: number }
    expenses: {
        series: ChartPoint[]
        total: number
        breakdown: { supplier: number; labour: number; misc: number }
    }
    liabilities: { series: ChartPoint[]; total: number }
    customerUdhar: { series: ChartPoint[]; total: number }
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
        }),
        getCustomerAnalytics: builder.query<{ customers: CustomerAnalyticsRow[] }, { from?: string; to?: string; q?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                if (arg?.q) params.set('q', arg.q)
                const qs = params.toString()
                return qs ? `/analytics/customers?${qs}` : '/analytics/customers'
            },
            transformResponse: (response: ApiEnvelope<{ customers: CustomerAnalyticsRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Customers', 'Orders', 'CustomerTransactions']
        }),
        getCustomerAnalyticsDetail: builder.query<CustomerAnalyticsDetail, string>({
            query: (id) => `/analytics/customers/${id}`,
            transformResponse: (response: ApiEnvelope<CustomerAnalyticsDetail>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Analytics', id }, 'Customers', 'Orders', 'CustomerTransactions']
        }),
        getSupplierAnalytics: builder.query<{ suppliers: SupplierAnalyticsRow[] }, { from?: string; to?: string; q?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                if (arg?.q) params.set('q', arg.q)
                const qs = params.toString()
                return qs ? `/analytics/suppliers?${qs}` : '/analytics/suppliers'
            },
            transformResponse: (response: ApiEnvelope<{ suppliers: SupplierAnalyticsRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Suppliers', 'RestockOrders', 'SupplierTransactions']
        }),
        getSupplierAnalyticsDetail: builder.query<SupplierAnalyticsDetail, string>({
            query: (id) => `/analytics/suppliers/${id}`,
            transformResponse: (response: ApiEnvelope<SupplierAnalyticsDetail>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Analytics', id: `supplier-${id}` }, 'Suppliers', 'RestockOrders', 'SupplierTransactions']
        }),
        getLabourAnalytics: builder.query<{ labourers: LabourAnalyticsRow[] }, { from?: string; to?: string; q?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                if (arg?.q) params.set('q', arg.q)
                const qs = params.toString()
                return qs ? `/analytics/labourers?${qs}` : '/analytics/labourers'
            },
            transformResponse: (response: ApiEnvelope<{ labourers: LabourAnalyticsRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Labourers', 'LabourProduction', 'LabourerTransactions']
        }),
        getLabourAnalyticsDetail: builder.query<LabourAnalyticsDetail, string>({
            query: (id) => `/analytics/labourers/${id}`,
            transformResponse: (response: ApiEnvelope<LabourAnalyticsDetail>) => unwrapData(response),
            providesTags: (_r, _e, id) => [{ type: 'Analytics', id: `labourer-${id}` }, 'Labourers', 'LabourProduction', 'LabourerTransactions']
        }),
        getInventoryCustomerAnalytics: builder.query<{ customers: InventoryCustomerRow[] }, { from?: string; to?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                const qs = params.toString()
                return qs ? `/analytics/inventory/customers?${qs}` : '/analytics/inventory/customers'
            },
            transformResponse: (response: ApiEnvelope<{ customers: InventoryCustomerRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Customers', 'Orders', 'Products']
        }),
        getInventorySupplierAnalytics: builder.query<{ suppliers: InventorySupplierRow[] }, { from?: string; to?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                const qs = params.toString()
                return qs ? `/analytics/inventory/suppliers?${qs}` : '/analytics/inventory/suppliers'
            },
            transformResponse: (response: ApiEnvelope<{ suppliers: InventorySupplierRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Suppliers', 'RestockOrders', 'Products']
        }),
        getInventoryLabourAnalytics: builder.query<{ labourers: InventoryLabourRow[] }, { from?: string; to?: string } | void>({
            query: (arg) => {
                const params = new URLSearchParams()
                if (arg?.from) params.set('from', arg.from)
                if (arg?.to) params.set('to', arg.to)
                const qs = params.toString()
                return qs ? `/analytics/inventory/labourers?${qs}` : '/analytics/inventory/labourers'
            },
            transformResponse: (response: ApiEnvelope<{ labourers: InventoryLabourRow[] }>) => unwrapData(response),
            providesTags: ['Analytics', 'Labourers', 'LabourProduction', 'Products']
        }),
        exportCustomerBalanceSheet: builder.mutation<Blob, { id: string; from?: string; to?: string; q?: string }>({
            query: ({ id, from, to, q }) => {
                const params = new URLSearchParams()
                if (from) params.set('from', from)
                if (to) params.set('to', to)
                if (q) params.set('q', q)
                const qs = params.toString()
                return {
                    url: qs ? `/analytics/customers/${id}/balance-sheet?${qs}` : `/analytics/customers/${id}/balance-sheet`,
                    responseHandler: (response) => response.blob()
                }
            }
        }),
        exportSupplierBalanceSheet: builder.mutation<Blob, { id: string; from?: string; to?: string; q?: string }>({
            query: ({ id, from, to, q }) => {
                const params = new URLSearchParams()
                if (from) params.set('from', from)
                if (to) params.set('to', to)
                if (q) params.set('q', q)
                const qs = params.toString()
                return {
                    url: qs ? `/analytics/suppliers/${id}/balance-sheet?${qs}` : `/analytics/suppliers/${id}/balance-sheet`,
                    responseHandler: (response) => response.blob()
                }
            }
        }),
        exportLabourBalanceSheet: builder.mutation<Blob, { id: string; from?: string; to?: string; q?: string }>({
            query: ({ id, from, to, q }) => {
                const params = new URLSearchParams()
                if (from) params.set('from', from)
                if (to) params.set('to', to)
                if (q) params.set('q', q)
                const qs = params.toString()
                return {
                    url: qs ? `/analytics/labourers/${id}/balance-sheet?${qs}` : `/analytics/labourers/${id}/balance-sheet`,
                    responseHandler: (response) => response.blob()
                }
            }
        })
    })
})

export const {
    useGetHomeAnalyticsQuery,
    useGetUpcomingDeliveriesQuery,
    useGetStockVsPendingQuery,
    usePostponeDeliveryMutation,
    useGetCustomerAnalyticsQuery,
    useGetCustomerAnalyticsDetailQuery,
    useGetSupplierAnalyticsQuery,
    useGetSupplierAnalyticsDetailQuery,
    useGetLabourAnalyticsQuery,
    useGetLabourAnalyticsDetailQuery,
    useGetInventoryCustomerAnalyticsQuery,
    useGetInventorySupplierAnalyticsQuery,
    useGetInventoryLabourAnalyticsQuery,
    useExportCustomerBalanceSheetMutation,
    useExportSupplierBalanceSheetMutation,
    useExportLabourBalanceSheetMutation
} = analyticsApi

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

export async function downloadBusinessDataExcel(getToken: () => string | null) {
    const token = getToken()
    const response = await fetch(`${constants.API_BASE}/analytics/export/business-data`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    })

    if (!response.ok) {
        let message = 'Business data export failed'
        try {
            const payload = (await response.json()) as { message?: string }
            if (payload.message) message = payload.message
        } catch {
            /* ignore */
        }
        throw new Error(message)
    }

    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const fileName = match?.[1] ?? `gujrat-factory-business-data-${new Date().toISOString().slice(0, 10)}.xlsx`

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
    return fileName
}
