import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    useAddProductMutation,
    useCreateUnitMutation,
    useEditProductMutation,
    useGetUnitsQuery,
    useRestockProductMutation
} from '@/redux/api/productsApi'
import type { Product } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { CategoryMultiSelect } from '@/components/products/CategoryMultiSelect'
import { useLanguage } from '@/hooks/useLanguage'

const DEFAULT_UNIT_ID = 'unit-pcs'

export function ProductFormDialog({
    open,
    onOpenChange,
    product,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSuccess: () => void
}) {
    const { t } = useLanguage()
    const { data: unitsData } = useGetUnitsQuery()
    const [addProduct, { isLoading: adding }] = useAddProductMutation()
    const [editProduct, { isLoading: editing }] = useEditProductMutation()
    const [createUnit, { isLoading: creatingUnit }] = useCreateUnitMutation()

    const [form, setForm] = useState({
        name: '',
        categoryIds: [] as string[],
        price: '',
        stockQty: '0',
        totalBill: '0',
        discount: '0',
        unitId: DEFAULT_UNIT_ID
    })
    const [newUnitOpen, setNewUnitOpen] = useState(false)
    const [newUnitName, setNewUnitName] = useState('')

    const units = unitsData?.units ?? []

    useEffect(() => {
        if (product) {
            setForm({
                name: product.name,
                categoryIds: product.categoryIds ?? product.categories?.map((c) => c.id ?? c._id) ?? [],
                price: String(product.price),
                stockQty: String(product.stockQty),
                totalBill: String(product.purchasePrice ?? product.price),
                discount: String(product.discount ?? 0),
                unitId: product.unitId ?? product.unit?.id ?? DEFAULT_UNIT_ID
            })
        } else {
            setForm({
                name: '',
                categoryIds: [],
                price: '',
                stockQty: '0',
                totalBill: '0',
                discount: '0',
                unitId: DEFAULT_UNIT_ID
            })
        }
        setNewUnitOpen(false)
        setNewUnitName('')
    }, [product, open])

    const handleCreateUnit = async () => {
        const name = newUnitName.trim()
        if (!name) {
            toast.error('Enter a unit name')
            return
        }
        try {
            const { unit } = await createUnit({ name }).unwrap()
            toast.success('Unit created')
            setNewUnitOpen(false)
            setNewUnitName('')
            setForm((prev) => ({ ...prev, unitId: unit.id ?? unit._id }))
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not create unit'))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.unitId) {
            toast.error('Select a unit')
            return
        }

        try {
            if (product) {
                await editProduct({
                    id: product.id ?? product._id,
                    name: form.name,
                    categoryIds: form.categoryIds,
                    price: Number(form.price),
                    unitId: form.unitId
                }).unwrap()
                toast.success('Product updated')
            } else {
                const stockQty = Number(form.stockQty)
                if (Number.isNaN(stockQty) || stockQty < 0) {
                    toast.error('Stock quantity must be zero or greater')
                    return
                }
                await addProduct({
                    name: form.name,
                    categoryIds: form.categoryIds,
                    price: Number(form.price),
                    stockQty,
                    totalBill: Number(form.totalBill) || 0,
                    discount: Number(form.discount) || 0,
                    unitId: form.unitId
                }).unwrap()
                toast.success('Product added')
            }
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'))
        }
    }

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit}
                        className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label>Name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <CategoryMultiSelect
                            value={form.categoryIds}
                            onChange={(categoryIds) => setForm({ ...form, categoryIds })}
                            labels={{
                                selectCategories: t.inventory.selectCategories,
                                noCategoriesSelected: t.inventory.noCategoriesSelected,
                                createCategory: t.inventory.createCategory,
                                categoryName: t.inventory.categoryName,
                                parentCategory: t.inventory.parentCategory,
                                noParent: t.inventory.noParent
                            }}
                        />
                        <div className="space-y-2">
                            <Label>Unit</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={form.unitId}
                                    onValueChange={(value) => setForm({ ...form, unitId: value })}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem
                                                key={unit.id ?? unit._id}
                                                value={unit.id ?? unit._id}>
                                                {unit.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setNewUnitOpen(true)}
                                    title="Create new unit">
                                    <Plus className="size-4" />
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Customer price</Label>
                            <Input
                                type="number"
                                min={0}
                                step="any"
                                value={form.price}
                                onChange={(e) => setForm({ ...form, price: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Stock Qty</Label>
                            <Input
                                type="number"
                                min={0}
                                step="any"
                                value={form.stockQty}
                                onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                                disabled={!!product}
                                readOnly={!!product}
                                required={!product}
                            />
                            {product ? <p className="text-muted-foreground text-xs">Use Restock to change quantity.</p> : null}
                        </div>
                        {!product ? (
                            <>
                                <div className="space-y-2">
                                    <Label>Total cost</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={form.totalBill}
                                        onChange={(e) => setForm({ ...form, totalBill: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Customer discount</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step="any"
                                        value={form.discount}
                                        onChange={(e) => setForm({ ...form, discount: e.target.value })}
                                    />
                                </div>
                            </>
                        ) : null}
                        <DialogFooter className="sm:col-span-2">
                            <Button
                                type="submit"
                                disabled={adding || editing}>
                                {product ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={newUnitOpen}
                onOpenChange={setNewUnitOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Create unit</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="new-unit-name">Unit name</Label>
                            <Input
                                id="new-unit-name"
                                value={newUnitName}
                                onChange={(e) => setNewUnitName(e.target.value)}
                                placeholder="e.g. dozen, carton, yard"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void handleCreateUnit()
                                    }
                                }}
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setNewUnitOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={creatingUnit || !newUnitName.trim()}
                                onClick={() => void handleCreateUnit()}>
                                Create
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}

export function RestockDialog({
    open,
    onOpenChange,
    product,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSuccess: () => void
}) {
    const [restock, { isLoading }] = useRestockProductMutation()
    const [form, setForm] = useState({ price: '', stockQty: '', totalBill: '', discount: '0' })

    useEffect(() => {
        if (product) {
            setForm({
                price: String(product.price),
                stockQty: '',
                totalBill: '',
                discount: String(product.discount ?? 0)
            })
        }
    }, [product, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!product) return
        const stockQty = Number(form.stockQty)
        if (!stockQty || stockQty <= 0) {
            toast.error('Restock quantity must be greater than zero')
            return
        }
        try {
            await restock({
                id: product.id ?? product._id,
                price: Number(form.price),
                stockQty,
                totalBill: Number(form.totalBill),
                discount: Number(form.discount)
            }).unwrap()
            toast.success('Product restocked')
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Restock failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Restock {product?.name}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Customer price</Label>
                        <Input
                            type="number"
                            min={0}
                            step="any"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Stock Qty</Label>
                        <Input
                            type="number"
                            min={1}
                            step="any"
                            value={form.stockQty}
                            onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Total cost</Label>
                        <Input
                            type="number"
                            min={0}
                            step="any"
                            value={form.totalBill}
                            onChange={(e) => setForm({ ...form, totalBill: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Customer discount</Label>
                        <Input
                            type="number"
                            min={0}
                            step="any"
                            value={form.discount}
                            onChange={(e) => setForm({ ...form, discount: e.target.value })}
                        />
                    </div>
                    <DialogFooter className="sm:col-span-2">
                        <Button
                            type="submit"
                            disabled={isLoading}>
                            Restock
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
