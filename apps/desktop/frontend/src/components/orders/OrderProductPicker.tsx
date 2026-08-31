import { SearchInput } from '@/components/shared/SearchInput'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Product } from '@/types/api'

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

export function OrderProductPicker({
    products,
    search,
    onSearch,
    onAdd,
    emptyMessage = 'No products found'
}: {
    products: Product[]
    search: string
    onSearch: (value: string) => void
    onAdd: (product: Product) => void
    emptyMessage?: string
}) {
    return (
        <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                <p className="text-sm font-medium">Products</p>
                <SearchInput
                    value={search}
                    onChange={onSearch}
                    placeholder="Search products"
                    className="max-w-56"
                />
            </div>
            <div className="max-h-[28rem] overflow-auto lg:max-h-[min(32rem,calc(100vh-22rem))]">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={3}
                                    className="text-muted-foreground py-8 text-center">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((product) => {
                                const id = product.id ?? product._id
                                const discount = product.discount ?? 0
                                return (
                                    <TableRow
                                        key={id}
                                        className="cursor-pointer"
                                        onClick={() => onAdd(product)}>
                                        <TableCell className="whitespace-normal">
                                            <p className="font-medium">{product.name}</p>
                                            <p className="text-muted-foreground text-xs">{product.category}</p>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {formatPkr(product.price)}
                                            {discount > 0 ? <p className="text-muted-foreground text-xs">− {formatPkr(discount)}</p> : null}
                                        </TableCell>
                                        <TableCell className="text-right">{product.stockQty.toLocaleString()}</TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
