import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateRestockOrderMutation } from '@/redux/api/restockApi'
import { useGetSuppliersQuery } from '@/redux/api/suppliersApi'
import type { Supplier, SupplierProduct } from '@/types/api'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type LineItem = { productId: string; productName: string; qtyOrdered: number; unitCost: number }

export function CreateRestockOrderDialog({
    open,
    onOpenChange,
    defaultSupplier,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultSupplier?: Supplier | null
    onSuccess?: () => void
}) {
    const { data: suppliersData } = useGetSuppliersQuery()
    const [createOrder, { isLoading }] = useCreateRestockOrderMutation()

    const [supplierId, setSupplierId] = useState('')
    const [referenceNumber, setReferenceNumber] = useState('')
    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState<LineItem[]>([])
    const [addProductId, setAddProductId] = useState('')
    const [addQty, setAddQty] = useState('1')
    const [addCost, setAddCost] = useState('')

    const suppliers = suppliersData?.suppliers?.filter((s) => s.isActive) ?? []
    const selectedSupplier = suppliers.find((s) => (s.id ?? s._id) === supplierId) ?? defaultSupplier ?? null
    const supplierProducts = (selectedSupplier?.products ?? []) as SupplierProduct[]

    useEffect(() => {
        if (!open) return
        setSupplierId(defaultSupplier ? (defaultSupplier.id ?? defaultSupplier._id) : '')
        setReferenceNumber('')
        setNotes('')
        setLines([])
        setAddProductId('')
        setAddQty('1')
        setAddCost('')
    }, [open, defaultSupplier])

    const total = useMemo(() => lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0), [lines])

    const addLine = () => {
        if (!addProductId) {
            toast.error('Select a product')
            return
        }
        const qty = Number(addQty)
        const cost = Number(addCost)
        if (!qty || qty <= 0 || Number.isNaN(cost) || cost < 0) {
            toast.error('Enter valid quantity and unit cost')
            return
        }
        const product = supplierProducts.find((p) => (p.id ?? p._id) === addProductId)
        if (!product) return

        setLines((prev) => {
            const existing = prev.find((l) => l.productId === addProductId)
            if (existing) {
                return prev.map((l) => (l.productId === addProductId ? { ...l, qtyOrdered: l.qtyOrdered + qty, unitCost: cost } : l))
            }
            return [...prev, { productId: addProductId, productName: product.name, qtyOrdered: qty, unitCost: cost }]
        })
        setAddProductId('')
        setAddQty('1')
        setAddCost('')
    }

    const removeLine = (productId: string) => {
        setLines((prev) => prev.filter((l) => l.productId !== productId))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!supplierId) {
            toast.error('Select a supplier')
            return
        }
        if (lines.length === 0) {
            toast.error('Add at least one product')
            return
        }
        try {
            await createOrder({
                supplierId,
                items: lines.map(({ productId, qtyOrdered, unitCost }) => ({ productId, qtyOrdered, unitCost })),
                referenceNumber: referenceNumber || undefined,
                notes: notes || undefined
            }).unwrap()
            toast.success('Restock order created')
            onSuccess?.()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to create restock order'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>New restock order</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    {!defaultSupplier ? (
                        <div className="space-y-2">
                            <Label>Supplier</Label>
                            <Select
                                value={supplierId}
                                onValueChange={setSupplierId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((s) => (
                                        <SelectItem
                                            key={s.id ?? s._id}
                                            value={s.id ?? s._id}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <p className="text-sm">
                            <span className="text-muted-foreground">Supplier:</span> {defaultSupplier.name}
                        </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Reference #</Label>
                            <Input
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="PO number"
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Notes</Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </div>

                    {supplierId ? (
                        <div className="space-y-2 rounded-lg border p-3">
                            <Label>Add line item</Label>
                            {supplierProducts.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Link products to this supplier first (Products button on Suppliers page).
                                </p>
                            ) : (
                                <>
                                    <Select
                                        value={addProductId}
                                        onValueChange={(id) => {
                                            setAddProductId(id)
                                            const p = supplierProducts.find((x) => (x.id ?? x._id) === id)
                                            if (p?.unitCost != null) setAddCost(String(p.unitCost))
                                            else if (p?.purchasePrice) setAddCost(String(p.purchasePrice))
                                        }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {supplierProducts.map((p) => (
                                                <SelectItem
                                                    key={p.id ?? p._id}
                                                    value={p.id ?? p._id}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            min={1}
                                            placeholder="Qty"
                                            value={addQty}
                                            onChange={(e) => setAddQty(e.target.value)}
                                            className="w-24"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder="Unit cost"
                                            value={addCost}
                                            onChange={(e) => setAddCost(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={addLine}>
                                            <Plus className="size-4" />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : null}

                    {lines.length > 0 ? (
                        <div className="space-y-2">
                            {lines.map((line) => (
                                <div
                                    key={line.productId}
                                    className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                                    <div>
                                        <p className="font-medium">{line.productName}</p>
                                        <p className="text-muted-foreground">
                                            {line.qtyOrdered} × {line.unitCost} = {(line.qtyOrdered * line.unitCost).toFixed(0)}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeLine(line.productId)}>
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                            <p className="text-right font-semibold">Total: {total.toFixed(0)}</p>
                        </div>
                    ) : null}

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isLoading || lines.length === 0}>
                            Create draft order
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
