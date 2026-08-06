import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CategoryMultiSelect } from '@/components/products/CategoryMultiSelect'
import { collectDescendantIds } from '@/components/products/CategorySidebar'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetCategoriesQuery } from '@/redux/api/categoriesApi'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { usePermissions } from '@/hooks/usePermissions'
import { useRemoveLabourRateMutation, useSetLabourRateMutation, useSetLabourRatesByCategoriesMutation } from '@/redux/api/labourApi'
import type { Labourer } from '@/types/api'
import { FolderTree, Trash2 } from 'lucide-react'
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
    const { data: categoriesData } = useGetCategoriesQuery()
    const { canWrite, canDelete } = usePermissions()
    const [setRate, { isLoading: saving }] = useSetLabourRateMutation()
    const [setRatesByCategories, { isLoading: savingCategories }] = useSetLabourRatesByCategoriesMutation()
    const [removeRate, { isLoading: removing }] = useRemoveLabourRateMutation()
    const [productId, setProductId] = useState('')
    const [ratePerUnit, setRatePerUnit] = useState('')
    const [categoryIds, setCategoryIds] = useState<string[]>([])
    const [categoryRate, setCategoryRate] = useState('')

    const products = productsData?.products ?? []
    const categories = categoriesData?.categories ?? []

    useEffect(() => {
        setProductId('')
        setRatePerUnit('')
        setCategoryIds([])
        setCategoryRate('')
    }, [open, labourer])

    const categoryProductPreview = useMemo(() => {
        if (!categoryIds.length) return []
        const allowed = new Set<string>()
        for (const id of categoryIds) {
            for (const descendant of collectDescendantIds(categories, id)) {
                allowed.add(descendant)
            }
        }
        return products.filter((p) => (p.categoryIds ?? p.categories?.map((c) => c.id ?? c._id) ?? []).some((id) => allowed.has(id)))
    }, [categoryIds, categories, products])

    if (!labourer) return null

    const labourerId = labourer.id ?? labourer._id
    const rates = labourer.rates ?? []
    const ratedIds = new Set(rates.map((r) => r.productId))

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        const rate = Number(ratePerUnit)
        if (!productId || !Number.isFinite(rate) || rate < 0) {
            toast.error('Select product and enter a valid rate (decimals allowed)')
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

    const handleAddByCategories = async (e: React.FormEvent) => {
        e.preventDefault()
        const rate = Number(categoryRate)
        if (!categoryIds.length || !Number.isFinite(rate) || rate < 0) {
            toast.error('Select categories and enter a valid rate (decimals allowed)')
            return
        }
        try {
            const result = await setRatesByCategories({ labourerId, categoryIds, ratePerUnit: rate }).unwrap()
            const updated = result?.data?.updated ?? (result as { updated?: number })?.updated
            toast.success(typeof updated === 'number' ? `Saved rate for ${updated} product(s)` : 'Rates saved for category products')
            setCategoryIds([])
            setCategoryRate('')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to save category rates'))
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
                <p className="text-muted-foreground text-sm">Pay per unit produced for each inventory item. Decimals are allowed.</p>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
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
                                                    <Trash2 className="text-destructive size-4" />
                                                </Button>
                                            ) : null}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-sm">No rates defined yet.</p>
                    )}

                    {canWrite ? (
                        <>
                            <form
                                onSubmit={handleAddByCategories}
                                className="space-y-3 rounded-lg border p-3">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    <FolderTree className="size-4" /> Set rate by category
                                </p>
                                <p className="text-muted-foreground text-xs">
                                    Applies the same rate to every product in the selected categories and nested subcategories.
                                </p>
                                <CategoryMultiSelect
                                    value={categoryIds}
                                    onChange={setCategoryIds}
                                    labels={{
                                        selectCategories: 'Categories',
                                        noCategoriesSelected: 'No categories selected',
                                        createCategory: 'Create category',
                                        categoryName: 'Category name',
                                        parentCategory: 'Parent category',
                                        noParent: 'None (top level)'
                                    }}
                                />
                                {categoryIds.length > 0 ? (
                                    <p className="text-muted-foreground text-xs">
                                        {categoryProductPreview.length} product(s) will receive this rate
                                        {categoryProductPreview.length
                                            ? `: ${categoryProductPreview
                                                  .slice(0, 4)
                                                  .map((p) => p.name)
                                                  .join(', ')}${categoryProductPreview.length > 4 ? '…' : ''}`
                                            : ''}
                                    </p>
                                ) : null}
                                <div className="space-y-2">
                                    <Label>Rate per unit (PKR)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="any"
                                        inputMode="decimal"
                                        placeholder="e.g. 12.5"
                                        value={categoryRate}
                                        onChange={(e) => setCategoryRate(e.target.value)}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={savingCategories || !categoryIds.length}>
                                    Apply rate to category products
                                </Button>
                            </form>

                            <form
                                onSubmit={handleAdd}
                                className="space-y-3 rounded-lg border p-3">
                                <Label>Add rate for one product</Label>
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
                                                    {p.category ? ` (${p.category})` : ''}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                                <div className="space-y-2">
                                    <Label>Rate per unit (PKR)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="any"
                                        inputMode="decimal"
                                        placeholder="e.g. 12.5"
                                        value={ratePerUnit}
                                        onChange={(e) => setRatePerUnit(e.target.value)}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={saving}>
                                    Save rate
                                </Button>
                            </form>
                        </>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
