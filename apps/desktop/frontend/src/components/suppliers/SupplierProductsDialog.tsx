import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { usePermissions } from '@/hooks/usePermissions'
import { useLinkSupplierProductMutation, useUnlinkSupplierProductMutation } from '@/redux/api/suppliersApi'
import type { Supplier, SupplierProduct } from '@/types/api'
import { Link2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function SupplierProductsDialog({
    open,
    onOpenChange,
    supplier,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplier: Supplier | null
    onSuccess?: () => void
}) {
    const { data: productsData } = useGetProductsQuery()
    const { canWrite, canDelete } = usePermissions()
    const [linkProduct, { isLoading: linking }] = useLinkSupplierProductMutation()
    const [unlinkProduct, { isLoading: unlinking }] = useUnlinkSupplierProductMutation()

    const [productId, setProductId] = useState('')
    const [supplierSku, setSupplierSku] = useState('')
    const [unitCost, setUnitCost] = useState('')
    const [isPreferred, setIsPreferred] = useState(false)

    const allProducts = productsData?.products ?? []
    const linked = supplier?.products ?? []
    const linkedIds = new Set(linked.map((p) => p.id ?? p._id))

    const availableProducts = useMemo(() => allProducts.filter((p) => !linkedIds.has(p.id ?? p._id)), [allProducts, linkedIds])

    if (!supplier) return null

    const supplierId = supplier.id ?? supplier._id

    const handleLink = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!productId) {
            toast.error('Select a product')
            return
        }
        try {
            await linkProduct({
                supplierId,
                productId,
                supplierSku: supplierSku || undefined,
                unitCost: unitCost ? Number(unitCost) : undefined,
                isPreferred
            }).unwrap()
            toast.success('Product linked')
            setProductId('')
            setSupplierSku('')
            setUnitCost('')
            setIsPreferred(false)
            onSuccess?.()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to link product'))
        }
    }

    const handleUnlink = async (product: SupplierProduct) => {
        try {
            await unlinkProduct({ supplierId, productId: product.id ?? product._id }).unwrap()
            toast.success('Product unlinked')
            onSuccess?.()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to unlink product'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Products — {supplier.name}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {linked.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Unit cost</TableHead>
                                    <TableHead>Preferred</TableHead>
                                    <TableHead />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {linked.map((product) => (
                                    <TableRow key={product.id ?? product._id}>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.supplierSku ?? '—'}</TableCell>
                                        <TableCell>{product.unitCost ?? '—'}</TableCell>
                                        <TableCell>{product.isPreferred ? <Badge>Preferred</Badge> : '—'}</TableCell>
                                        <TableCell>
                                            {canDelete ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive"
                                                    disabled={unlinking}
                                                    onClick={() => handleUnlink(product)}>
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground">No products linked yet.</p>
                    )}

                    {canWrite ? (
                        <form
                            onSubmit={handleLink}
                            className="space-y-3 rounded-lg border p-4">
                            <p className="flex items-center gap-2 text-sm font-medium">
                                <Link2 className="size-4" /> Link a product
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Product</Label>
                                    <Select
                                        value={productId}
                                        onValueChange={(id) => {
                                            setProductId(id)
                                            const p = allProducts.find((x) => (x.id ?? x._id) === id)
                                            if (p?.purchasePrice) setUnitCost(String(p.purchasePrice))
                                        }}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableProducts.map((p) => (
                                                <SelectItem
                                                    key={p.id ?? p._id}
                                                    value={p.id ?? p._id}>
                                                    {p.name} ({p.category})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier SKU</Label>
                                    <Input
                                        value={supplierSku}
                                        onChange={(e) => setSupplierSku(e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unit cost</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={unitCost}
                                        onChange={(e) => setUnitCost(e.target.value)}
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="flex items-center gap-2 sm:col-span-2">
                                    <Switch
                                        id="preferred"
                                        checked={isPreferred}
                                        onCheckedChange={setIsPreferred}
                                    />
                                    <Label htmlFor="preferred">Preferred supplier for this product</Label>
                                </div>
                            </div>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={linking || !productId}>
                                Link product
                            </Button>
                        </form>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
