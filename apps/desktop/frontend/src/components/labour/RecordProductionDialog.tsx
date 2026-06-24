import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetRecipesQuery } from '@/redux/api/recipesApi'
import { useGetLabourersQuery, useRecordProductionMutation } from '@/redux/api/labourApi'
import { toast } from 'sonner'

export function RecordProductionDialog({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}) {
    const { data: labourersData } = useGetLabourersQuery()
    const { data: recipesData } = useGetRecipesQuery()
    const [record, { isLoading }] = useRecordProductionMutation()

    const [labourerId, setLabourerId] = useState('')
    const [productId, setProductId] = useState('')
    const [qtyProduced, setQtyProduced] = useState('')
    const [notes, setNotes] = useState('')

    const labourers = labourersData?.labourers?.filter((l) => l.isActive) ?? []
    const selectedLabourer = labourers.find((l) => (l.id ?? l._id) === labourerId)
    const ratedProducts = selectedLabourer?.rates ?? []

    const recipe = useMemo(() => {
        if (!productId) return null
        return (recipesData?.recipes ?? []).find((r) => r.outputProductId === productId) ?? null
    }, [productId, recipesData])

    const selectedRate = ratedProducts.find((r) => r.productId === productId)
    const qty = Number(qtyProduced) || 0
    const estimatedPay = selectedRate ? selectedRate.ratePerUnit * qty : 0

    useEffect(() => {
        if (!open) return
        setLabourerId('')
        setProductId('')
        setQtyProduced('')
        setNotes('')
    }, [open])

    useEffect(() => {
        setProductId('')
    }, [labourerId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const qtyNum = Number(qtyProduced)
        if (!labourerId || !productId || !qtyNum || qtyNum <= 0) {
            toast.error('Fill all required fields')
            return
        }
        try {
            await record({ labourerId, productId, qtyProduced: qtyNum, notes: notes || undefined }).unwrap()
            toast.success('Production recorded — stock updated')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to record production'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Record production</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Adds finished goods to inventory. If the product has a recipe, ingredients are deducted automatically.
                    </p>

                    <div className="space-y-2">
                        <Label>Worker</Label>
                        <Select
                            value={labourerId}
                            onValueChange={setLabourerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select worker" />
                            </SelectTrigger>
                            <SelectContent>
                                {labourers.map((l) => (
                                    <SelectItem
                                        key={l.id ?? l._id}
                                        value={l.id ?? l._id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {labourerId ? (
                        <div className="space-y-2">
                            <Label>Product produced</Label>
                            <Select
                                value={productId}
                                onValueChange={setProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ratedProducts.map((r) => (
                                        <SelectItem
                                            key={r.productId}
                                            value={r.productId}>
                                            {r.product?.name ?? r.productId} (rate: {r.ratePerUnit})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {ratedProducts.length === 0 ? <p className="text-xs text-destructive">Assign rates to this worker first.</p> : null}
                        </div>
                    ) : null}

                    {productId && recipe?.items?.length ? (
                        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                            <p className="mb-1 font-medium">Recipe will consume (per batch):</p>
                            <ul className="list-inside list-disc text-muted-foreground">
                                {recipe.items.map((i) => (
                                    <li key={i.ingredientProductId}>
                                        {i.product?.name} × {i.qty}
                                        {qty > 0 ? ` → ${(i.qty * qty).toFixed(2)} total` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : productId ? (
                        <Badge variant="outline">No recipe — only output stock increases</Badge>
                    ) : null}

                    <div className="space-y-2">
                        <Label>Quantity produced</Label>
                        <Input
                            type="number"
                            min={1}
                            value={qtyProduced}
                            onChange={(e) => setQtyProduced(e.target.value)}
                            required
                        />
                    </div>

                    {selectedRate && qty > 0 ? (
                        <p className="text-sm">
                            Labour pay: <strong>{estimatedPay.toFixed(0)} PKR</strong>
                        </p>
                    ) : null}

                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isLoading || !productId}>
                            Record
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
