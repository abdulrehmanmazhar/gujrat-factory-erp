import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { usePermissions } from '@/hooks/usePermissions'
import { useRemoveLabourRateMutation, useSetLabourRateMutation } from '@/redux/api/labourApi'
import type { Labourer } from '@/types/api'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function LabourRatesDialog({
    open,
    onOpenChange,
    labourer,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    labourer: Labourer | null
    onSuccess: () => void
}) {
    const { data: productsData } = useGetProductsQuery()
    const { canWrite, canDelete } = usePermissions()
    const [setRate, { isLoading: saving }] = useSetLabourRateMutation()
    const [removeRate, { isLoading: removing }] = useRemoveLabourRateMutation()
    const [productId, setProductId] = useState('')
    const [ratePerUnit, setRatePerUnit] = useState('')

    const products = productsData?.products ?? []

    useEffect(() => {
        setProductId('')
        setRatePerUnit('')
    }, [open, labourer])

    if (!labourer) return null

    const labourerId = labourer.id ?? labourer._id
    const rates = labourer.rates ?? []
    const ratedIds = new Set(rates.map((r) => r.productId))

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const rate = Number(ratePerUnit)
        if (!productId || Number.isNaN(rate) || rate < 0) {
            toast.error('Select product and enter a valid rate')
            return
        }
        try {
            await setRate({ labourerId, productId, ratePerUnit: rate }).unwrap()
            toast.success('Rate saved')
            setProductId('')
            setRatePerUnit('')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to save rate'))
        }
    }

    const handleRemove = async (pid: string) => {
        try {
            await removeRate({ labourerId, productId: pid }).unwrap()
            toast.success('Rate removed')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to remove rate'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Rates — {labourer.name}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Pay per unit produced for each inventory item.</p>

                {rates.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Rate / unit</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rates.map((r) => (
                                <TableRow key={r.productId}>
                                    <TableCell>{r.product?.name ?? r.productId}</TableCell>
                                    <TableCell>{r.ratePerUnit}</TableCell>
                                    <TableCell>
                                        {canDelete ? (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={removing}
                                                onClick={() => handleRemove(r.productId)}>
                                                <Trash2 className="size-4 text-destructive" />
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground">No rates defined yet.</p>
                )}

                {canWrite ? (
                    <form
                        onSubmit={handleAdd}
                        className="space-y-3 rounded-lg border p-3">
                        <Label>Add rate</Label>
                        <Select
                            value={productId}
                            onValueChange={setProductId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Product" />
                            </SelectTrigger>
                            <SelectContent>
                                {products
                                    .filter((p) => !ratedIds.has(p.id ?? p._id))
                                    .map((p) => (
                                        <SelectItem
                                            key={p.id ?? p._id}
                                            value={p.id ?? p._id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                        <Input
                            type="number"
                            min={0}
                            placeholder="Rate per unit (PKR)"
                            value={ratePerUnit}
                            onChange={(e) => setRatePerUnit(e.target.value)}
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={saving}>
                            Save rate
                        </Button>
                    </form>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
