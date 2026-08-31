import { type ReactNode } from 'react'
import { LabelledAmountList } from '@/components/orders/LabelledAmountList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { LabelledAmount } from '@/types/api'

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

export function OrderDetailsPanel({
    meta,
    message,
    onMessage,
    additionalCharges,
    onCharges,
    additionalDiscounts,
    onDiscounts,
    invoiceBreakdown,
    onInvoiceBreakdown,
    paymentLabel,
    paymentHint,
    payment,
    onPayment,
    paymentMax,
    subtotal,
    discountTotal,
    chargesTotal,
    total,
    submitLabel,
    submitting,
    canSubmit,
    onSubmit
}: {
    meta?: ReactNode
    message: string
    onMessage: (value: string) => void
    additionalCharges: LabelledAmount[]
    onCharges: (rows: LabelledAmount[]) => void
    additionalDiscounts: LabelledAmount[]
    onDiscounts: (rows: LabelledAmount[]) => void
    invoiceBreakdown: boolean
    onInvoiceBreakdown: (value: boolean) => void
    paymentLabel: string
    paymentHint?: string
    payment: string
    onPayment: (value: string) => void
    paymentMax: number
    subtotal: number
    discountTotal: number
    chargesTotal: number
    total: number
    submitLabel: string
    submitting: boolean
    canSubmit: boolean
    onSubmit: () => void
}) {
    return (
        <div className="space-y-4 border-t px-3 py-3">
            {meta}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="order-message">Note</Label>
                    <Textarea
                        id="order-message"
                        value={message}
                        onChange={(e) => onMessage(e.target.value)}
                        rows={2}
                        placeholder="Optional"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="order-payment">{paymentLabel}</Label>
                    <Input
                        id="order-payment"
                        type="number"
                        min={0}
                        max={paymentMax}
                        value={payment}
                        onChange={(e) => onPayment(e.target.value)}
                        placeholder="0"
                    />
                    {paymentHint ? <p className="text-muted-foreground text-xs">{paymentHint}</p> : null}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <LabelledAmountList
                    title="Additional charges"
                    rows={additionalCharges}
                    onChange={onCharges}
                    descriptionPlaceholder="e.g. Delivery"
                />
                <LabelledAmountList
                    title="Additional discounts"
                    rows={additionalDiscounts}
                    onChange={onDiscounts}
                    descriptionPlaceholder="e.g. Loyalty discount"
                />
            </div>

            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={invoiceBreakdown}
                    onChange={(e) => onInvoiceBreakdown(e.target.checked)}
                    className="size-4 rounded border"
                />
                Show price breakdown on invoice
            </label>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Items</span>
                    <span>{formatPkr(subtotal)}</span>
                </div>
                {discountTotal > 0 ? (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Discounts</span>
                        <span>− {formatPkr(discountTotal)}</span>
                    </div>
                ) : null}
                {chargesTotal > 0 ? (
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Extra charges</span>
                        <span>+ {formatPkr(chargesTotal)}</span>
                    </div>
                ) : null}
                <div className="flex justify-between border-t pt-1 text-base font-semibold">
                    <span>Grand total</span>
                    <span>{formatPkr(total)}</span>
                </div>
            </div>

            <div className="flex justify-end">
                <Button
                    disabled={submitting || !canSubmit}
                    onClick={onSubmit}>
                    {submitLabel}
                </Button>
            </div>
        </div>
    )
}
