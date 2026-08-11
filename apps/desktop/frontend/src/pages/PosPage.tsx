import { useMemo, useState } from 'react'
import { LabelledAmountList, parseLabelledAmountRows } from '@/components/orders/LabelledAmountList'
import { CustomerSearchSelect } from '@/components/shared/CustomerSearchSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useCreateOrderMutation } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import type { CartLine, LabelledAmount, Product } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PosPage() {
    const { data: productsData } = useGetProductsQuery()
    const [createOrder, { isLoading: placing }] = useCreateOrderMutation()

    const [customerId, setCustomerId] = useState('')
    const [productSearch, setProductSearch] = useState('')
    const [cart, setCart] = useState<CartLine[]>([])
    const [message, setMessage] = useState('')
    const [additionalCharges, setAdditionalCharges] = useState<LabelledAmount[]>([])
    const [additionalDiscounts, setAdditionalDiscounts] = useState<LabelledAmount[]>([])
    const [invoiceBreakdown, setInvoiceBreakdown] = useState(true)
    const [payment, setPayment] = useState('')

    const products = productsData?.products ?? []

    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products.filter((p) => p.inStock && p.stockQty > 0)
        const q = productSearch.toLowerCase()
        return products.filter((p) => p.inStock && p.stockQty > 0 && (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)))
    }, [products, productSearch])

    const chargeRows = useMemo(() => parseLabelledAmountRows(additionalCharges), [additionalCharges])
    const discountRows = useMemo(() => parseLabelledAmountRows(additionalDiscounts), [additionalDiscounts])
    const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0)
    const lineDiscount = cart.reduce((sum, line) => sum + (line.product.discount ?? 0) * line.qty, 0)
    const extraDiscount = discountRows.reduce((sum, row) => sum + row.amount, 0)
    const chargesTotal = chargeRows.reduce((sum, row) => sum + row.amount, 0)
    const total = Math.max(0, subtotal - lineDiscount - extraDiscount + chargesTotal)
    const today = new Date().toISOString().slice(0, 10)

    const addToCart = (product: Product) => {
        setCart((prev) => {
            const id = product.id ?? product._id
            const existing = prev.find((l) => l.productId === id)
            if (existing) {
                if (existing.qty >= product.stockQty) {
                    toast.error('Not enough stock')
                    return prev
                }
                return prev.map((l) => (l.productId === id ? { ...l, qty: l.qty + 1 } : l))
            }
            return [...prev, { productId: id, product, qty: 1 }]
        })
    }

    const updateQty = (productId: string, delta: number) => {
        setCart(
            (prev) =>
                prev
                    .map((line) => {
                        if (line.productId !== productId) return line
                        const nextQty = line.qty + delta
                        if (nextQty <= 0) return null
                        if (nextQty > line.product.stockQty) {
                            toast.error('Not enough stock')
                            return line
                        }
                        return { ...line, qty: nextQty }
                    })
                    .filter(Boolean) as CartLine[]
        )
    }

    const removeLine = (productId: string) => {
        setCart((prev) => prev.filter((l) => l.productId !== productId))
    }

    const clearCart = () => {
        setCart([])
        setMessage('')
        setAdditionalCharges([])
        setAdditionalDiscounts([])
        setInvoiceBreakdown(true)
        setPayment('')
    }

    const handlePlaceOrder = async () => {
        if (!customerId) {
            toast.error('Select a customer')
            return
        }
        if (cart.length === 0) {
            toast.error('Add at least one product')
            return
        }
        const incompleteCharge =
            additionalCharges.some((row) => row.description.trim() || row.amount !== '') &&
            additionalCharges.some((row) => !row.description.trim() || !(Number(row.amount) > 0))
        const incompleteDiscount =
            additionalDiscounts.some((row) => row.description.trim() || row.amount !== '') &&
            additionalDiscounts.some((row) => !row.description.trim() || !(Number(row.amount) > 0))
        if (incompleteCharge || incompleteDiscount) {
            toast.error('Fill description and amount for every charge/discount row')
            return
        }
        const paid = payment === '' ? total : Number(payment)
        if (Number.isNaN(paid) || paid < 0) {
            toast.error('Enter a valid payment amount')
            return
        }
        if (paid > total) {
            toast.error('Payment cannot exceed order total')
            return
        }
        try {
            await createOrder({
                customerId,
                cart: cart.map(({ productId, qty }) => ({ productId, qty })),
                deliveryDate: today,
                message,
                additionalCharges: chargeRows,
                additionalDiscounts: discountRows,
                invoiceBreakdown,
                orderMode: 'pos',
                payment: paid
            }).unwrap()
            toast.success('Order placed successfully')
            clearCart()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to place order'))
        }
    }

    return (
        <div>
            <PageHeader
                title="POS"
                description="Create new customer orders"
            />

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Customer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CustomerSearchSelect
                                value={customerId}
                                onChange={setCustomerId}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-2">
                                <CardTitle className="text-base">Products</CardTitle>
                                <SearchInput
                                    value={productSearch}
                                    onChange={setProductSearch}
                                    placeholder="Search..."
                                    className="max-w-xs"
                                />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {filteredProducts.map((product) => (
                                    <button
                                        key={product.id ?? product._id}
                                        type="button"
                                        onClick={() => addToCart(product)}
                                        className="flex items-start justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50">
                                        <div>
                                            <p className="font-medium">{product.name}</p>
                                            <p className="text-xs text-muted-foreground">{product.category}</p>
                                            <p className="mt-1 text-sm">
                                                Rs {product.price}
                                                {(product.discount ?? 0) > 0 ? (
                                                    <span className="text-muted-foreground"> · disc {product.discount}</span>
                                                ) : null}
                                            </p>
                                        </div>
                                        <Badge variant="outline">{product.stockQty} left</Badge>
                                    </button>
                                ))}
                                {filteredProducts.length === 0 ? (
                                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No products in stock</p>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ShoppingCart className="size-4" /> Cart
                            </CardTitle>
                            {cart.length > 0 ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearCart}>
                                    Clear
                                </Button>
                            ) : null}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {cart.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">Cart is empty</p>
                        ) : (
                            cart.map((line) => (
                                <div
                                    key={line.productId}
                                    className="flex items-center gap-2 rounded-lg border p-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{line.product.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Rs {line.product.price} × {line.qty}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => updateQty(line.productId, -1)}>
                                            <Minus className="size-3" />
                                        </Button>
                                        <span className="w-6 text-center text-sm">{line.qty}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => updateQty(line.productId, 1)}>
                                            <Plus className="size-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 text-destructive"
                                            onClick={() => removeLine(line.productId)}>
                                            <Trash2 className="size-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="delivery-date">Delivery date</Label>
                            <Input
                                id="delivery-date"
                                type="date"
                                value={today}
                                disabled
                            />
                            <p className="text-xs text-muted-foreground">POS orders are delivered immediately.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="order-message">Message</Label>
                            <Textarea
                                id="order-message"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={2}
                                placeholder="Optional note"
                            />
                        </div>

                        <LabelledAmountList
                            title="Additional charges"
                            rows={additionalCharges}
                            onChange={setAdditionalCharges}
                            descriptionPlaceholder="e.g. Delivery"
                        />
                        <LabelledAmountList
                            title="Additional discounts"
                            rows={additionalDiscounts}
                            onChange={setAdditionalDiscounts}
                            descriptionPlaceholder="e.g. Loyalty discount"
                        />

                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={invoiceBreakdown}
                                onChange={(e) => setInvoiceBreakdown(e.target.checked)}
                                className="size-4 rounded border"
                            />
                            Breakdown invoice details
                        </label>

                        <div className="space-y-2">
                            <Label htmlFor="pos-payment">Payment received</Label>
                            <Input
                                id="pos-payment"
                                type="number"
                                min={0}
                                max={total}
                                value={payment || (total > 0 ? String(total) : '')}
                                onChange={(e) => setPayment(e.target.value)}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-1 text-sm">
                            {(lineDiscount + extraDiscount > 0 || chargesTotal > 0) && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Items</span>
                                        <span>Rs {subtotal.toFixed(0)}</span>
                                    </div>
                                    {lineDiscount + extraDiscount > 0 ? (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Discounts</span>
                                            <span>− Rs {(lineDiscount + extraDiscount).toFixed(0)}</span>
                                        </div>
                                    ) : null}
                                    {chargesTotal > 0 ? (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Extra charges</span>
                                            <span>+ Rs {chargesTotal.toFixed(0)}</span>
                                        </div>
                                    ) : null}
                                </>
                            )}
                            <div className="flex justify-between text-base font-semibold">
                                <span>Order price</span>
                                <span>Rs {total.toFixed(0)}</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            className="w-full"
                            disabled={placing || cart.length === 0}
                            onClick={handlePlaceOrder}>
                            {placing ? 'Placing order...' : 'Place order'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
