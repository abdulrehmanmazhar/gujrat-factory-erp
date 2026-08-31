import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PaymentProofFields, usePaymentProofFields } from '@/components/shared/PaymentProofFields'
import { restockOutstanding } from '@/components/suppliers/RestockOrderDialogs'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateSupplierKhataMutation } from '@/redux/api/khataApi'
import { useGetRestockOrdersQuery, useRecordRestockPaymentMutation } from '@/redux/api/restockApi'
import { useGetSuppliersQuery } from '@/redux/api/suppliersApi'
import type { KhataDirection, RestockOrder } from '@/types/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const STANDALONE = 'standalone'

function formatPkr(amount: number) {
    return `PKR ${Number(amount || 0).toLocaleString()}`
}

export type SupplierAnalyticsTxnContext = {
    supplierId?: string | null
    restockOrderId?: string | null
    direction?: KhataDirection
}

export function SupplierAnalyticsTransactionDialog({
    open,
    onOpenChange,
    context,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    context: SupplierAnalyticsTxnContext | null
    onSuccess: () => void
}) {
    const { data: suppliersData } = useGetSuppliersQuery(undefined, { skip: !open })
    const { data: restockData } = useGetRestockOrdersQuery(undefined, { skip: !open })
    const [createKhata, { isLoading: savingKhata }] = useCreateSupplierKhataMutation()
    const [recordPayment, { isLoading: savingPayment }] = useRecordRestockPaymentMutation()
    const proof = usePaymentProofFields(open)

    const [supplierId, setSupplierId] = useState('')
    const [restockOrderId, setRestockOrderId] = useState(STANDALONE)
    const [direction, setDirection] = useState<KhataDirection>('out')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const suppliers = suppliersData?.suppliers ?? []
    const restockOrders = restockData?.orders ?? []
    const supplierLocked = Boolean(context?.supplierId)
    const restockLocked = Boolean(context?.restockOrderId)
    const directionLocked = Boolean(context?.direction)

    useEffect(() => {
        if (!open) return
        setSupplierId(context?.supplierId ?? '')
        setRestockOrderId(context?.restockOrderId ?? STANDALONE)
        setDirection(context?.direction ?? 'out')
        setAmount('')
        setDescription('')
    }, [open, context])

    const supplierRestocks = useMemo(
        () => restockOrders.filter((order) => order.supplierId === supplierId && order.status === 'received'),
        [restockOrders, supplierId]
    )

    const selectedSupplier = suppliers.find((supplier) => (supplier.id ?? supplier._id) === supplierId)
    const selectedRestock: RestockOrder | null = supplierRestocks.find((order) => (order.id ?? order._id) === restockOrderId) ?? null
    const linked = restockOrderId !== STANDALONE

    const limit = linked
        ? selectedRestock && direction === 'out'
            ? restockOutstanding(selectedRestock)
            : null
        : direction === 'out'
          ? (selectedSupplier?.payable ?? 0)
          : null

    const linkedInBlocked = linked && direction === 'in'
    const help = linkedInBlocked
        ? 'Restock returns must go through Refund on the restock order (creates a payable Out for returned goods).'
        : linked
          ? `Records a restock payment to the supplier (payable Out). Outstanding on this order: ${formatPkr(limit ?? 0)}.`
          : direction === 'out'
            ? 'Standalone Out — reduces payable and cannot exceed current payable.'
            : 'Standalone In — increases payable.'

    const isLoading = savingKhata || savingPayment
    const title = linkedInBlocked
        ? 'Restock refund'
        : linked
          ? 'Restock payment'
          : direction === 'out'
            ? 'Standalone transaction Out'
            : 'Standalone transaction In'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (linkedInBlocked) {
            toast.error('Use Refund on the restock order to return stock')
            return
        }
        const parsedAmount = Number(amount)
        if (!supplierId) {
            toast.error('Select a supplier')
            return
        }
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error('Enter a valid amount')
            return
        }
        if (limit != null && parsedAmount > limit) {
            toast.error(`Amount cannot exceed ${formatPkr(limit)}`)
            return
        }
        const linkedId = selectedRestock ? (selectedRestock.id ?? selectedRestock._id) : linked ? restockOrderId : ''
        if (linked && !linkedId) {
            toast.error('Select a valid restock order to link this payment')
            return
        }

        try {
            if (linked && linkedId) {
                await recordPayment({
                    id: linkedId,
                    amount: parsedAmount,
                    notes: description.trim() || undefined,
                    paymentMode: proof.paymentMode,
                    proofImage: proof.proofImage
                }).unwrap()
                toast.success('Restock payment recorded')
            } else {
                await createKhata({
                    partyId: supplierId,
                    direction,
                    amount: parsedAmount,
                    description: description.trim() || undefined,
                    paymentMode: proof.paymentMode,
                    proofImage: proof.proofImage
                }).unwrap()
                toast.success('Standalone transaction recorded')
            }
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not record transaction'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <p className="text-muted-foreground text-sm">{help}</p>

                    <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Select
                            value={supplierId}
                            onValueChange={(value) => {
                                setSupplierId(value)
                                if (!restockLocked) setRestockOrderId(STANDALONE)
                            }}
                            disabled={supplierLocked}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select supplier" />
                            </SelectTrigger>
                            <SelectContent>
                                {suppliers.map((supplier) => {
                                    const id = supplier.id ?? supplier._id
                                    return (
                                        <SelectItem
                                            key={id}
                                            value={id}>
                                            {supplier.name}
                                            {supplier.isActive ? '' : ' (inactive)'} (payable {formatPkr(supplier.payable ?? 0)})
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <Select
                            value={direction}
                            onValueChange={(value) => setDirection(value as KhataDirection)}
                            disabled={directionLocked}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="out">Out (payable −)</SelectItem>
                                <SelectItem value="in">In (payable +)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Link to restock order</Label>
                        <Select
                            value={restockOrderId}
                            onValueChange={setRestockOrderId}
                            disabled={restockLocked || !supplierId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Standalone (not linked)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={STANDALONE}>Standalone (not linked)</SelectItem>
                                {supplierRestocks.map((order) => {
                                    const id = order.id ?? order._id
                                    return (
                                        <SelectItem
                                            key={id}
                                            value={id}>
                                            {order.referenceNumber || `#${id.slice(0, 8)}`} · due {formatPkr(restockOutstanding(order))}
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    {!linkedInBlocked ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="supplier-analytics-txn-amount">Amount (PKR)</Label>
                                <Input
                                    id="supplier-analytics-txn-amount"
                                    type="number"
                                    min={0.01}
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                                {limit != null ? <p className="text-muted-foreground text-xs">Maximum: {formatPkr(limit)}</p> : null}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="supplier-analytics-txn-note">Note (optional)</Label>
                                <Textarea
                                    id="supplier-analytics-txn-note"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Optional note for this entry"
                                />
                            </div>

                            <PaymentProofFields
                                paymentMode={proof.paymentMode}
                                onPaymentModeChange={proof.setPaymentMode}
                                proofImage={proof.proofImage}
                                onProofImageChange={proof.setProofImage}
                            />
                        </>
                    ) : null}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || linkedInBlocked || (linked && !restockLocked && !selectedRestock)}>
                            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
