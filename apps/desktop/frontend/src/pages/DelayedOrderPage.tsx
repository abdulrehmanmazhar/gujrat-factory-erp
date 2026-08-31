import { useMemo, useState } from 'react'
import { parseLabelledAmountRows } from '@/components/orders/LabelledAmountList'
import { OrderDetailsPanel } from '@/components/orders/OrderDetailsPanel'
import { OrderEntryHeader } from '@/components/orders/OrderEntryHeader'
import { OrderEntryShell } from '@/components/orders/OrderEntryShell'
import { OrderItemsTable } from '@/components/orders/OrderItemsTable'
import { OrderProductPicker } from '@/components/orders/OrderProductPicker'
import { CustomerSearchSelect } from '@/components/shared/CustomerSearchSelect'
import { PageHeader } from '@/components/shared/PageHeader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateOrderMutation } from '@/redux/api/ordersApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import type { CartLine, LabelledAmount, Product } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { toast } from 'sonner'

export default function DelayedOrderPage() {
    const { data: productsData } = useGetProductsQuery()
    const [createOrder, { isLoading: placing }] = useCreateOrderMutation()

    const [customerId, setCustomerId] = useState('')
    const [productSearch, setProductSearch] = useState('')
    const [cart, setCart] = useState<CartLine[]>([])
    const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [message, setMessage] = useState('')
    const [additionalCharges, setAdditionalCharges] = useState<LabelledAmount[]>([])
    const [additionalDiscounts, setAdditionalDiscounts] = useState<LabelledAmount[]>([])
    const [invoiceBreakdown, setInvoiceBreakdown] = useState(true)
    const [payment, setPayment] = useState('')

    const products = productsData?.products ?? []
    const today = new Date().toISOString().slice(0, 10)

    const filteredProducts = useMemo(() => {
        if (!productSearch.trim()) return products
        const q = productSearch.toLowerCase()
        return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    }, [products, productSearch])

    const chargeRows = useMemo(() => parseLabelledAmountRows(additionalCharges), [additionalCharges])
    const discountRows = useMemo(() => parseLabelledAmountRows(additionalDiscounts), [additionalDiscounts])
    const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0)
    const lineDiscount = cart.reduce((sum, line) => sum + (line.product.discount ?? 0) * line.qty, 0)
    const extraDiscount = discountRows.reduce((sum, row) => sum + row.amount, 0)
    const chargesTotal = chargeRows.reduce((sum, row) => sum + row.amount, 0)
    const total = Math.max(0, subtotal - lineDiscount - extraDiscount + chargesTotal)

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

    const updateQty = (productId: string, qty: number) => {
        setCart(
            (prev) =>
                prev
                    .map((line) => {
                        if (line.productId !== productId) return line
                        if (qty <= 0) return null
                        return { ...line, qty }
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
                additionalCharges: chargeRows,
                additionalDiscounts: discountRows,
                invoiceBreakdown,
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
            <PageHeader title="Delayed orders" />
            <OrderEntryShell
                header={<OrderEntryHeader />}
                customer={
                    <CustomerSearchSelect
                        value={customerId}
                        onChange={setCustomerId}
                    />
                }
                products={
                    <OrderProductPicker
                        products={filteredProducts}
                        search={productSearch}
                        onSearch={setProductSearch}
                        onAdd={addToCart}
                        emptyMessage="No products found"
                    />
                }
                items={
                    <OrderItemsTable
                        cart={cart}
                        onQtyChange={updateQty}
                        onRemove={removeLine}
                        onClear={clearCart}
                    />
                }
                details={
                    <OrderDetailsPanel
                        meta={
                            <div className="max-w-xs space-y-1">
                                <Label htmlFor="delivery-date">Delivery date</Label>
                                <Input
                                    id="delivery-date"
                                    type="date"
                                    min={today}
                                    value={deliveryDate}
                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                />
                                <p className="text-muted-foreground text-xs">
                                    Stock is deducted on the delivery date when enough stock is available; otherwise delivery moves forward by one
                                    day.
                                </p>
                            </div>
                        }
                        message={message}
                        onMessage={setMessage}
                        additionalCharges={additionalCharges}
                        onCharges={setAdditionalCharges}
                        additionalDiscounts={additionalDiscounts}
                        onDiscounts={setAdditionalDiscounts}
                        invoiceBreakdown={invoiceBreakdown}
                        onInvoiceBreakdown={setInvoiceBreakdown}
                        paymentLabel="Advance payment (optional)"
                        paymentHint="Leave empty for no payment now. Remaining balance can be collected later from Orders."
                        payment={payment}
                        onPayment={setPayment}
                        paymentMax={total}
                        subtotal={subtotal}
                        discountTotal={lineDiscount + extraDiscount}
                        chargesTotal={chargesTotal}
                        total={total}
                        submitLabel={placing ? 'Saving order...' : 'Save delayed order'}
                        submitting={placing}
                        canSubmit={cart.length > 0}
                        onSubmit={handlePlaceOrder}
                    />
                }
            />
        </div>
    )
}
