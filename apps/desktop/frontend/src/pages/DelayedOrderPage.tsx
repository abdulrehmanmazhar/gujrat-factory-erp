import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import { useCreateOrderMutation } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import type { CartLine, Customer, Product } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { CalendarClock, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function DelayedOrderPage() {
    const { data: customersData } = useGetCustomersQuery()
    const { data: productsData } = useGetProductsQuery()
    const [createOrder, { isLoading: placing }] = useCreateOrderMutation()

    const [customerId, setCustomerId] = useState('')
    const [productSearch, setProductSearch] = useState('')
    const [cart, setCart] = useState<CartLine[]>([])
    const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [message, setMessage] = useState('')
    const [additionalDiscount, setAdditionalDiscount] = useState('0')
    const [payment, setPayment] = useState('')

    const customers = customersData?.customers ?? []
    const products = productsData?.products ?? []
    const today = new Date().toISOString().slice(0, 10)

    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products
        const q = productSearch.toLowerCase()
        return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    }, [products, productSearch])

    const selectedCustomer = customers.find((c) => (c.id ?? c._id) === customerId)

    const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0)
    const lineDiscount = cart.reduce((sum, line) => sum + (line.product.discount ?? 0) * line.qty, 0)
    const extraDiscount = Number(additionalDiscount) || 0
    const total = Math.max(0, subtotal - lineDiscount - extraDiscount)

    const addToCart = (product: Product) => {
        setCart((prev) => {
            const id = product.id ?? product._id
            const existing = prev.find((l) => l.productId === id)
            if (existing) {
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
        setAdditionalDiscount('0')
        setPayment('')
        setDeliveryDate(today)
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
        if (!deliveryDate) {
            toast.error('Select a delivery date')
            return
        }
        if (deliveryDate < today) {
            toast.error('Delivery date cannot be in the past')
            return
        }

        const paid = payment === '' ? 0 : Number(payment)
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
                deliveryDate,
                message,
                additionalDiscount: extraDiscount,
                orderMode: 'delayed',
                payment: paid
            }).unwrap()
            toast.success('Delayed order saved')
            clearCart()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to save order'))
        }
    }

    return (
        <div>
            <PageHeader
                title="Delayed orders"
                description="Schedule delivery for a future date. Orders can exceed current stock; stock is checked on the delivery date."
            />

            <div className="grid gap-6 lg:grid-cols-5">
                <div className="space-y-4 lg:col-span-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Customer</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={customerId}
                                onValueChange={setCustomerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.map((c: Customer) => (
                                        <SelectItem
                                            key={c.id ?? c._id}
                                            value={c.id ?? c._id}>
                                            {c.name} — {c.contact}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedCustomer ? (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {selectedCustomer.address}
                                    {selectedCustomer.udhar > 0 ? ` · Udhar: ${selectedCustomer.udhar}` : ''}
                                </p>
                            ) : null}
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
                                        <Badge variant={product.stockQty > 0 ? 'outline' : 'destructive'}>{product.stockQty} in stock</Badge>
                                    </button>
                                ))}
                                {filteredProducts.length === 0 ? (
                                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No products found</p>
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
                                min={today}
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                            />
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarClock className="size-3" />
                                Stock is deducted on the delivery date when enough stock is available; otherwise delivery moves forward by one day.
                            </p>
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
                        <div className="space-y-2">
                            <Label htmlFor="extra-discount">Additional discount</Label>
                            <Input
                                id="extra-discount"
                                type="number"
                                min={0}
                                value={additionalDiscount}
                                onChange={(e) => setAdditionalDiscount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="delayed-payment">Advance payment (optional)</Label>
                            <Input
                                id="delayed-payment"
                                type="number"
                                min={0}
                                max={total}
                                value={payment}
                                onChange={(e) => setPayment(e.target.value)}
                                placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave empty for no payment now. Remaining balance can be collected later from Orders.
                            </p>
                        </div>

                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span>Rs {subtotal.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Discounts</span>
                                <span>Rs {(lineDiscount + extraDiscount).toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between text-base font-semibold">
                                <span>Total</span>
                                <span>Rs {total.toFixed(0)}</span>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            className="w-full"
                            disabled={placing || cart.length === 0}
                            onClick={handlePlaceOrder}>
                            {placing ? 'Saving order...' : 'Save delayed order'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
