import { useEffect, useState } from 'react'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetRecentTransactionsQuery, useGetSalesMutation } from '@/redux/api/usersApi'
import type { CustomerTransaction, SupplierTransaction } from '@/types/api'

type Range = 'today' | 'month' | 'year'

function formatWhen(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

function customerTypeLabel(type: string) {
    if (type === 'sale') return 'Sale'
    if (type === 'refund') return 'Refund'
    if (type === 'udhar_payment') return 'Udhar payment'
    return type
}

function supplierTypeLabel(type: string) {
    if (type === 'payment') return 'Payment'
    if (type === 'refund') return 'Refund'
    return type
}

function customerTypeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (type === 'sale') return 'default'
    if (type === 'refund') return 'destructive'
    return 'secondary'
}

function supplierTypeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (type === 'payment') return 'default'
    if (type === 'refund') return 'secondary'
    return 'outline'
}

export default function DashboardPage() {
    const [getSales, { isLoading: salesLoading }] = useGetSalesMutation()
    const { data: recentData, isLoading: recentLoading } = useGetRecentTransactionsQuery(10)
    const [range, setRange] = useState<Range>('today')
    const [total, setTotal] = useState(0)
    const [count, setCount] = useState(0)

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

    return (
        <div>
            <PageHeader
                title="Dashboard"
                description="Sales overview and recent customer and supplier transactions"
            />

            <div className="mb-4 flex flex-wrap gap-2">
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

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
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
                                {
                                    key: 'createdAt',
                                    label: 'When',
                                    render: (row) => formatWhen(String(row.createdAt ?? ''))
                                },
                                {
                                    key: 'customer',
                                    label: 'Customer',
                                    render: (row) => (row.customer as { name?: string })?.name ?? '—'
                                },
                                {
                                    key: 'type',
                                    label: 'Type',
                                    render: (row) => (
                                        <Badge variant={customerTypeVariant(String(row.type))}>{customerTypeLabel(String(row.type))}</Badge>
                                    )
                                },
                                {
                                    key: 'amount',
                                    label: 'Amount',
                                    render: (row) => Number(row.amount ?? 0).toFixed(0)
                                },
                                {
                                    key: 'description',
                                    label: 'Description',
                                    render: (row) => String(row.description ?? '—')
                                }
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
                                {
                                    key: 'createdAt',
                                    label: 'When',
                                    render: (row) => formatWhen(String(row.createdAt ?? ''))
                                },
                                {
                                    key: 'supplier',
                                    label: 'Supplier',
                                    render: (row) => (row.supplier as { name?: string })?.name ?? '—'
                                },
                                {
                                    key: 'type',
                                    label: 'Type',
                                    render: (row) => (
                                        <Badge variant={supplierTypeVariant(String(row.type))}>{supplierTypeLabel(String(row.type))}</Badge>
                                    )
                                },
                                {
                                    key: 'amount',
                                    label: 'Amount',
                                    render: (row) => Number(row.amount ?? 0).toFixed(0)
                                },
                                {
                                    key: 'description',
                                    label: 'Description',
                                    render: (row) => String(row.description ?? '—')
                                }
                            ]}
                            rows={supplierRows as unknown as Record<string, unknown>[]}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
