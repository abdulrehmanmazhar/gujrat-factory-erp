import { useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import { useGetOrdersQuery } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { downloadAnalyticsExcel, useGetHomeAnalyticsQuery } from '@/redux/api/analyticsApi'
import { selectAuthToken } from '@/redux/slices/authSlice'
import { Package, ShoppingCart, Users, Wallet, Download } from 'lucide-react'
import { toast } from 'sonner'

function defaultRange() {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10)
    }
}

function ChartCard({
    title,
    total,
    data,
    exportReport,
    onExport,
    exporting
}: {
    title: string
    total: number
    data: { date: string; total: number }[]
    exportReport: string
    onExport: (report: string) => void
    exporting: string | null
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                    <CardTitle className="text-base">{title}</CardTitle>
                    <p className="text-sm text-muted-foreground">Total: PKR {total.toLocaleString()}</p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={exporting === exportReport}
                    onClick={() => onExport(exportReport)}>
                    <Download className="mr-2 size-4" />
                    Excel
                </Button>
            </CardHeader>
            <CardContent className="h-64">
                <ResponsiveContainer
                    width="100%"
                    height="100%">
                    <LineChart data={data}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}

export default function HomePage() {
    const token = useSelector(selectAuthToken)
    const [range, setRange] = useState(defaultRange)
    const [exporting, setExporting] = useState<string | null>(null)

    const { data: customers } = useGetCustomersQuery()
    const { data: products } = useGetProductsQuery()
    const { data: orders } = useGetOrdersQuery()
    const { data: analytics, isLoading } = useGetHomeAnalyticsQuery(range)

    const stats = [
        { title: 'Customers', value: customers?.customers?.length ?? 0, icon: Users },
        { title: 'Products', value: products?.products?.length ?? 0, icon: Package },
        { title: 'Orders', value: orders?.orders?.length ?? 0, icon: ShoppingCart },
        {
            title: 'Outstanding orders',
            value: (orders?.orders ?? []).filter((o) => (o.payment ?? 0) < (o.price ?? 0)).length,
            icon: Wallet
        }
    ]

    const stockChartData = useMemo(() => analytics?.stock.series.map((p) => ({ date: p.date, inbound: p.total })) ?? [], [analytics])

    const handleExport = async (report: string) => {
        setExporting(report)
        try {
            await downloadAnalyticsExcel(report, range.startDate, range.endDate, () => token)
            toast.success('Excel file downloaded')
        } catch {
            toast.error('Export failed')
        } finally {
            setExporting(null)
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Home"
                description="Overview of your factory ERP operations"
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Analytics period</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="start-date">From</Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={range.startDate}
                            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="end-date">To</Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={range.endDate}
                            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
                        />
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading analytics…</p>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    <ChartCard
                        title="Revenue (sales)"
                        total={analytics?.revenue.total ?? 0}
                        data={analytics?.revenue.series ?? []}
                        exportReport="revenue"
                        onExport={handleExport}
                        exporting={exporting}
                    />
                    <ChartCard
                        title="Labour salaries & production pay"
                        total={analytics?.labour.total ?? 0}
                        data={analytics?.labour.series ?? []}
                        exportReport="labour"
                        onExport={handleExport}
                        exporting={exporting}
                    />
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base">Expenses (supplier + labour)</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Total: PKR {(analytics?.expenses.total ?? 0).toLocaleString()} · Supplier:{' '}
                                    {(analytics?.expenses.breakdown?.supplier ?? 0).toLocaleString()} · Labour:{' '}
                                    {(analytics?.expenses.breakdown?.labour ?? 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={exporting === 'expenses-supplier'}
                                    onClick={() => handleExport('expenses-supplier')}>
                                    <Download className="mr-2 size-4" />
                                    Supplier Excel
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={exporting === 'expenses-labour'}
                                    onClick={() => handleExport('expenses-labour')}>
                                    <Download className="mr-2 size-4" />
                                    Labour Excel
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="h-64">
                            <ResponsiveContainer
                                width="100%"
                                height="100%">
                                <LineChart data={analytics?.expenses.series ?? []}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-muted"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="total"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base">Stock inbound (restock / production)</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Inbound units: {(analytics?.stock.totalInbound ?? 0).toLocaleString()} · Current stock:{' '}
                                    {(analytics?.stock.currentStockTotal ?? 0).toLocaleString()}
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={exporting === 'stock-history'}
                                onClick={() => handleExport('stock-history')}>
                                <Download className="mr-2 size-4" />
                                Excel
                            </Button>
                        </CardHeader>
                        <CardContent className="h-64">
                            <ResponsiveContainer
                                width="100%"
                                height="100%">
                                <BarChart data={stockChartData}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        className="stroke-muted"
                                    />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11 }}
                                    />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar
                                        dataKey="inbound"
                                        fill="hsl(var(--chart-2))"
                                        name="Inbound qty"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
