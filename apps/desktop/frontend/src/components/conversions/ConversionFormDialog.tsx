import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateConversionMutation } from '@/redux/api/conversionsApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'

function previewAmounts(inputRatio: number, outputRatio: number, mode: 'input' | 'output', qty: number) {
    if (!(inputRatio > 0) || !(outputRatio > 0) || !(qty > 0)) return null
    if (mode === 'input') {
        const inputQty = Math.round(qty)
        const outputQty = Math.round((inputQty * outputRatio) / inputRatio)
        if (inputQty <= 0 || outputQty <= 0) return null
        return { inputQty, outputQty }
    }
    const outputQty = Math.round(qty)
    const inputQty = Math.round((outputQty * inputRatio) / outputRatio)
    if (inputQty <= 0 || outputQty <= 0) return null
    return { inputQty, outputQty }
}

export function ConversionFormDialog({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}) {
    const { data: productsData } = useGetProductsQuery()
    const [createConversion, { isLoading }] = useCreateConversionMutation()
    const products = productsData?.products ?? []

    const [inputProductId, setInputProductId] = useState('')
    const [outputProductId, setOutputProductId] = useState('')
    const [inputRatio, setInputRatio] = useState('1')
    const [outputRatio, setOutputRatio] = useState('1')
    const [qtyMode, setQtyMode] = useState<'input' | 'output'>('input')
    const [qty, setQty] = useState('')
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (!open) return
        setInputProductId('')
        setOutputProductId('')
        setInputRatio('1')
        setOutputRatio('1')
        setQtyMode('input')
        setQty('')
        setNotes('')
    }, [open])

    const inputProduct = products.find((p) => (p.id ?? p._id) === inputProductId)
    const outputProduct = products.find((p) => (p.id ?? p._id) === outputProductId)

    const preview = useMemo(() => {
        const ir = Number(inputRatio)
        const or = Number(outputRatio)
        const q = Number(qty)
        return previewAmounts(ir, or, qtyMode, q)
    }, [inputRatio, outputRatio, qtyMode, qty])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputProductId || !outputProductId) {
            toast.error('Select input and output products')
            return
        }
        if (inputProductId === outputProductId) {
            toast.error('Input and output must be different products')
            return
        }
        const ir = Number(inputRatio)
        const or = Number(outputRatio)
        if (!(ir > 0) || !(or > 0)) {
            toast.error('Enter a valid conversion ratio')
            return
        }
        if (!preview) {
            toast.error('Enter a valid quantity to convert')
            return
        }

        try {
            await createConversion({
                inputProductId,
                outputProductId,
                inputRatio: ir,
                outputRatio: or,
                ...(qtyMode === 'input' ? { inputQty: preview.inputQty } : { outputQty: preview.outputQty }),
                notes: notes.trim() || undefined
            }).unwrap()
            toast.success('Conversion recorded')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Conversion failed'))
        }
    }

    const unitLabel = (product: typeof inputProduct) => product?.unit?.name ?? 'pcs'

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Convert inventory</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>From (input)</Label>
                            <Select
                                value={inputProductId}
                                onValueChange={setInputProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => {
                                        const id = p.id ?? p._id
                                        return (
                                            <SelectItem
                                                key={id}
                                                value={id}
                                                disabled={id === outputProductId}>
                                                {p.name} (stock {p.stockQty} {p.unit?.name ?? 'pcs'})
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>To (output)</Label>
                            <Select
                                value={outputProductId}
                                onValueChange={setOutputProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select product" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products.map((p) => {
                                        const id = p.id ?? p._id
                                        return (
                                            <SelectItem
                                                key={id}
                                                value={id}
                                                disabled={id === inputProductId}>
                                                {p.name} (stock {p.stockQty} {p.unit?.name ?? 'pcs'})
                                            </SelectItem>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                            <ArrowRightLeft className="size-4" />
                            Conversion relation
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                            <div className="space-y-2">
                                <Label>Input units</Label>
                                <Input
                                    type="number"
                                    min={0.0001}
                                    step="any"
                                    value={inputRatio}
                                    onChange={(e) => setInputRatio(e.target.value)}
                                    required
                                />
                                <p className="text-muted-foreground text-xs">{unitLabel(inputProduct)}</p>
                            </div>
                            <span className="text-muted-foreground pb-6 text-sm">=</span>
                            <div className="space-y-2">
                                <Label>Output units</Label>
                                <Input
                                    type="number"
                                    min={0.0001}
                                    step="any"
                                    value={outputRatio}
                                    onChange={(e) => setOutputRatio(e.target.value)}
                                    required
                                />
                                <p className="text-muted-foreground text-xs">{unitLabel(outputProduct)}</p>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Example: {inputRatio || '—'} {unitLabel(inputProduct)} of input equals {outputRatio || '—'} {unitLabel(outputProduct)} of
                            output.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Quantity to apply</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Select
                                value={qtyMode}
                                onValueChange={(v) => setQtyMode(v as 'input' | 'output')}>
                                <SelectTrigger className="sm:w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="input">I am converting this much input</SelectItem>
                                    <SelectItem value="output">I want this much output</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                placeholder={qtyMode === 'input' ? 'Input qty' : 'Output qty'}
                                required
                            />
                        </div>
                        {preview ? (
                            <p className="text-sm">
                                Will consume <span className="font-medium">{preview.inputQty}</span> {unitLabel(inputProduct)}
                                {inputProduct ? ` (${inputProduct.name})` : ''} and produce <span className="font-medium">{preview.outputQty}</span>{' '}
                                {unitLabel(outputProduct)}
                                {outputProduct ? ` (${outputProduct.name})` : ''}.
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-sm">Enter a quantity to see the stock movement preview.</p>
                        )}
                        {inputProduct && preview && inputProduct.stockQty < preview.inputQty ? (
                            <p className="text-destructive text-sm">
                                Not enough stock. Available: {inputProduct.stockQty} {unitLabel(inputProduct)}.
                            </p>
                        ) : null}
                    </div>

                    <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Optional note"
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading || !preview}>
                            {isLoading ? 'Converting…' : 'Convert'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
