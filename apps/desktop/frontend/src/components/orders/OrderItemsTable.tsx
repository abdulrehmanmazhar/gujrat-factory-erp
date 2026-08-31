import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CartLine } from '@/types/api'
import { Trash2 } from 'lucide-react'

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

export function OrderItemsTable({
    cart,
    onQtyChange,
    onRemove,
    onClear
}: {
    cart: CartLine[]
    onQtyChange: (productId: string, qty: number) => void
    onRemove: (productId: string) => void
    onClear: () => void
}) {
    return (
        <div>
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                <p className="text-sm font-medium">Selected items</p>
                {cart.length > 0 ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClear}>
                        Clear
                    </Button>
                ) : null}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Disc</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-8" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cart.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="text-muted-foreground py-10 text-center">
                                No items selected
                            </TableCell>
                        </TableRow>
                    ) : (
                        cart.map((line, index) => {
                            const discount = (line.product.discount ?? 0) * line.qty
                            const total = line.product.price * line.qty - discount
                            return (
                                <TableRow key={line.productId}>
                                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell className="whitespace-normal">
                                        <p className="font-medium">{line.product.name}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {line.product.unit?.name ?? 'pcs'} · {line.product.category}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={line.qty}
                                            onChange={(e) => {
                                                if (e.target.value === '') return
                                                const next = Number(e.target.value)
                                                if (!Number.isFinite(next)) return
                                                onQtyChange(line.productId, Math.floor(next))
                                            }}
                                            className="ml-auto h-8 w-20 text-right"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">{formatPkr(line.product.price)}</TableCell>
                                    <TableCell className="text-right">{discount > 0 ? formatPkr(discount) : '—'}</TableCell>
                                    <TableCell className="text-right font-medium">{formatPkr(total)}</TableCell>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive size-7"
                                            onClick={() => onRemove(line.productId)}>
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
