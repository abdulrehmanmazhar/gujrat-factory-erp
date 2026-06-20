import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import { useGetOrdersQuery } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { Package, ShoppingCart, Users, Wallet } from 'lucide-react'

export default function HomePage() {
    const { data: customers } = useGetCustomersQuery()
    const { data: products } = useGetProductsQuery()
    const { data: orders } = useGetOrdersQuery()

    const stats = [
        {
            title: 'Customers',
            value: customers?.customers?.length ?? 0,
            icon: Users
        },
        {
            title: 'Products',
            value: products?.products?.length ?? 0,
            icon: Package
        },
        {
            title: 'Orders',
            value: orders?.orders?.length ?? 0,
            icon: ShoppingCart
        },
        {
            title: 'Outstanding',
            value: (orders?.orders ?? []).filter((o) => (o.payment ?? 0) < (o.price ?? 0)).length,
            icon: Wallet
        }
    ]

    return (
        <div>
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
        </div>
    )
}
