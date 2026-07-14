import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePermissions } from '@/hooks/usePermissions'
import { useGetRecentTransactionsQuery, useGetSalesMutation } from '@/redux/api/usersApi'
import { useGetStockVsPendingQuery, useGetUpcomingDeliveriesQuery, usePostponeDeliveryMutation } from '@/redux/api/analyticsApi'
import type { CustomerTransaction, SupplierTransaction } from '@/types/api'
import { toast } from 'sonner'

type Range = 'today' | 'month' | 'year'

function formatWhen(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

function formatDate(value?: string | Date | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString()
}

export default function DashboardPage() {
    const { canWrite } = usePermissions()
    const [getSales, { isLoading: salesLoading }] = useGetSalesMutation()
    const { data: recentData, isLoading: recentLoading } = useGetRecentTransactionsQuery(10)
    const { data: upcomingData, isLoading: upcomingLoading } = useGetUpcomingDeliveriesQuery(14)
    const { data: stockData, isLoading: stockLoading } = useGetStockVsPendingQuery()
    const [postponeDelivery, { isLoading: postponing }] = usePostponeDeliveryMutation()

    const [range, setRange] = useState<Range>('today')
    const [total, setTotal] = useState(0)
    const [count, setCount] = useState(0)
    const [postponeOpen, setPostponeOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<{ id: string; orderNumber?: number | null } | null>(null)
    const [newDeliveryDate, setNewDeliveryDate] = useState('')

    useEffect(() => {
        const load = async () => {
            try {
                const result = await getSales({ dateRange: range, type: 'sale' }).unwrap()
                const sales = (result.sales ?? []) as { amount?: number }[]
                setCount(sales.length)
                setTotal(sales.reduce((sum, row) => sum + (row.amount ?? 0), 0))
            } catch {
                setCount(0)
                setTotal(0)
            }
        }
        load()
    }, [range, getSales])

    const customerRows = (recentData?.customerTransactions ?? []) as CustomerTransaction[]
    const supplierRows = (recentData?.supplierTransactions ?? []) as SupplierTransaction[]
    const upcomingOrders = upcomingData?.orders ?? []

    const stockChart = (stockData?.products ?? []).slice(0, 12).map((p) => ({
        name: p.name.length > 14 ? `${p.name.slice(0, 14)}…` : p.name,
        currentStock: p.currentStock,
        pendingQty: p.pendingQty,
        surplus: p.surplus
    }))

    const openPostpone = (order: Record<string, unknown>) => {
        setSelectedOrder({ id: String(order.id), orderNumber: order.orderNumber as number | null })
        setNewDeliveryDate('')
        setPostponeOpen(true)
    }

    const handlePostpone = async () => {
        if (!selectedOrder?.id || !newDeliveryDate) return
        try {
            await postponeDelivery({ id: selectedOrder.id, deliveryDate: newDeliveryDate }).unwrap()
            toast.success('Delivery date updated')
            setPostponeOpen(false)
        } catch {
            toast.error('Failed to postpone delivery')
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Dashboard"
                description="Sales overview, delivery reminders, and stock planning"
            />

            <div className="flex flex-wrap gap-2">
                {(['today', 'month', 'year'] as Range[]).map((r) => (
                    <Button
                        key={r}
                        variant={range === r ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRange(r)}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                    </Button>
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Sale transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{salesLoading ? '…' : count}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Revenue (PKR)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{salesLoading ? '…' : total.toFixed(0)}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Delayed deliveries — overdue &amp; next 14 days</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable
                        loading={upcomingLoading}
                        emptyMessage="No upcoming deliveries"
                        columns={[
                            {
                                key: 'orderNumber',
                                label: 'Order #',
                                render: (row) => String(row.orderNumber ?? '—')
                            },
                            {
                                key: 'customer',
                                label: 'Customer',
                                render: (row) => (row.customerDetails as { name?: string })?.name ?? '—'
                            },
                            {
                                key: 'deliveryDate',
                                label: 'Delivery',
                                render: (row) => {
                                    const raw = String(row.deliveryDate ?? '')
                                    const d = raw ? new Date(raw) : null
                                    const overdue = d && d < new Date(new Date().toDateString())
                                    return (
                                        <span className="inline-flex items-center gap-2">
                                            {formatDate(raw)}
                                            {overdue ? <Badge variant="destructive">Overdue</Badge> : null}
                                        </span>
                                    )
                                }
                            },
                            {
                                key: 'items',
                                label: 'Items',
                                render: (row) => ((row.cart as unknown[]) ?? []).length
                            },
                            {
                                key: 'actions',
                                label: '',
                                render: (row) =>
                                    canWrite ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => openPostpone(row)}>
                                            Postpone
                                        </Button>
                                    ) : (
                                        '—'
                                    )
                            }
                        ]}
                        rows={upcomingOrders as unknown as Record<string, unknown>[]}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Stock vs pending delayed demand</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Compares current warehouse stock with quantities reserved in undelivered delayed orders.
                    </p>
                </CardHeader>
                <CardContent className="h-80">
                    {stockLoading ? (
                        <p className="text-sm text-muted-foreground">Loading chart…</p>
                    ) : (
                        <ResponsiveContainer
                            width="100%"
                            height="100%">
                            <BarChart data={stockChart}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    className="stroke-muted"
                                />
                                <XAxis
                                    dataKey="name"
                                    tick={{ fontSize: 10 }}
                                    interval={0}
                                    angle={-25}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar
                                    dataKey="currentStock"
                                    fill="hsl(var(--chart-1))"
                                    name="Current stock"
                                />
                                <Bar
                                    dataKey="pendingQty"
                                    fill="hsl(var(--chart-3))"
                                    name="Pending demand"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Recent customer transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            loading={recentLoading}
                            emptyMessage="No customer transactions yet"
                            columns={[
                                { key: 'createdAt', label: 'When', render: (row) => formatWhen(String(row.createdAt ?? '')) },
                                { key: 'customer', label: 'Customer', render: (row) => (row.customer as { name?: string })?.name ?? '—' },
                                {
                                    key: 'type',
                                    label: 'Type',
                                    render: (row) => <Badge variant="secondary">{String(row.type)}</Badge>
                                },
                                { key: 'amount', label: 'Amount', render: (row) => Number(row.amount ?? 0).toFixed(0) }
                            ]}
                            rows={customerRows as unknown as Record<string, unknown>[]}
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Recent supplier transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable
                            loading={recentLoading}
                            emptyMessage="No supplier transactions yet"
                            columns={[
                                { key: 'createdAt', label: 'When', render: (row) => formatWhen(String(row.createdAt ?? '')) },
                                { key: 'supplier', label: 'Supplier', render: (row) => (row.supplier as { name?: string })?.name ?? '—' },
                                {
                                    key: 'type',
                                    label: 'Type',
                                    render: (row) => <Badge variant="outline">{String(row.type)}</Badge>
                                },
                                { key: 'amount', label: 'Amount', render: (row) => Number(row.amount ?? 0).toFixed(0) }
                            ]}
                            rows={supplierRows as unknown as Record<string, unknown>[]}
                        />
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={postponeOpen}
                onOpenChange={setPostponeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Postpone delivery</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Order #{selectedOrder?.orderNumber ?? '—'} — choose a new delivery date.</p>
                    <div className="space-y-2">
                        <Label htmlFor="new-delivery">New delivery date</Label>
                        <Input
                            id="new-delivery"
                            type="date"
                            value={newDeliveryDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setNewDeliveryDate(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPostponeOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!newDeliveryDate || postponing}
                            onClick={handlePostpone}>
                            {postponing ? 'Saving…' : 'Save new date'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
