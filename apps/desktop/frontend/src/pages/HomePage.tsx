import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/PageHeader'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import { useGetOrdersQuery } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { useGetHomeAnalyticsQuery } from '@/redux/api/analyticsApi'
import { Package, ShoppingCart, Users, Wallet } from 'lucide-react'

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
    subtitle,
    data,
    stroke = 'hsl(var(--primary))'
}: {
    title: string
    total: number
    subtitle?: string
    data: { date: string; total: number }[]
    stroke?: string
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                    {subtitle ?? 'Total'}: PKR {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
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
                            stroke={stroke}
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
    const [range, setRange] = useState(defaultRange)

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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Home"
                description="Financial overview of profit, expenses, and supplier liabilities"
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
                        title="Profit / Loss over time"
                        total={analytics?.profitLoss.total ?? 0}
                        subtitle="Net (sales − COGS − labour − misc)"
                        data={analytics?.profitLoss.series ?? []}
                        stroke="hsl(142 76% 36%)"
                    />
                    <ChartCard
                        title="Sales over time"
                        total={analytics?.sales.total ?? 0}
                        subtitle="Cash sales collected"
                        data={analytics?.sales.series ?? []}
                        stroke="hsl(221 83% 53%)"
                    />
                    <ChartCard
                        title="COGS over time"
                        total={analytics?.cogs.total ?? 0}
                        subtitle="FIFO cost of goods sold"
                        data={analytics?.cogs.series ?? []}
                        stroke="hsl(32 95% 44%)"
                    />
                    <ChartCard
                        title="Labour cost over time"
                        total={analytics?.labourCost.total ?? 0}
                        subtitle="Labour pay & production cost"
                        data={analytics?.labourCost.series ?? []}
                        stroke="hsl(262 83% 58%)"
                    />
                    <ChartCard
                        title="Miscellaneous expenses over time"
                        total={analytics?.miscCost.total ?? 0}
                        subtitle="Misc overhead"
                        data={analytics?.miscCost.series ?? []}
                        stroke="hsl(24 70% 45%)"
                    />
                    <ChartCard
                        title="Total expenses over time"
                        total={analytics?.expenses.total ?? 0}
                        subtitle={`Supplier ${analytics?.expenses.breakdown.supplier?.toLocaleString() ?? 0} · Labour ${analytics?.expenses.breakdown.labour?.toLocaleString() ?? 0} · Misc ${analytics?.expenses.breakdown.misc?.toLocaleString() ?? 0}`}
                        data={analytics?.expenses.series ?? []}
                        stroke="hsl(0 72% 51%)"
                    />
                    <ChartCard
                        title="Supplier liabilities over time"
                        total={analytics?.liabilities.total ?? 0}
                        subtitle="Supplier payable (end of period)"
                        data={analytics?.liabilities.series ?? []}
                        stroke="hsl(199 89% 40%)"
                    />
                    <ChartCard
                        title="Customer receivables over time"
                        total={analytics?.customerUdhar.total ?? 0}
                        subtitle="Derived outstanding (end of period)"
                        data={analytics?.customerUdhar.series ?? []}
                        stroke="hsl(173 58% 39%)"
                    />
                </div>
            )}
        </div>
    )
}
