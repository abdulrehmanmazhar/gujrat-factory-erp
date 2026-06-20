import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddProductMutation, useEditProductMutation, useRestockProductMutation } from '@/redux/api/productsApi'
import type { Product } from '@/types/api'
import { toast } from 'sonner'

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
    const [addProduct, { isLoading: adding }] = useAddProductMutation()
    const [editProduct, { isLoading: editing }] = useEditProductMutation()
    const [form, setForm] = useState({
        name: '',
        category: '',
        price: '',
        stockQty: '',
        totalBill: '',
        discount: '0'
    })

    useEffect(() => {
        if (product) {
            setForm({
                name: product.name,
                category: product.category,
                price: String(product.price),
                stockQty: String(product.stockQty),
                totalBill: String(product.purchasePrice ?? product.price),
                discount: String(product.discount ?? 0)
            })
        } else {
            setForm({ name: '', category: '', price: '', stockQty: '', totalBill: '', discount: '0' })
        }
    }, [product, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const payload = {
            name: form.name,
            category: form.category,
            price: Number(form.price),
            stockQty: Number(form.stockQty),
            totalBill: Number(form.totalBill),
            discount: Number(form.discount)
        }
        try {
            if (product) {
                await editProduct({
                    id: product.id ?? product._id,
                    name: payload.name,
                    category: payload.category,
                    price: payload.price,
                    stockQty: payload.stockQty
                }).unwrap()
                toast.success('Product updated')
            } else {
                await addProduct(payload).unwrap()
                toast.success('Product added')
            }
            onSuccess()
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Save failed')
        }
    }

    return (
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
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Input
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Price</Label>
                        <Input
                            type="number"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Stock Qty</Label>
                        <Input
                            type="number"
                            value={form.stockQty}
                            onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                            required
                        />
                    </div>
                    {!product ? (
                        <>
                            <div className="space-y-2">
                                <Label>Total Bill</Label>
                                <Input
                                    type="number"
                                    value={form.totalBill}
                                    onChange={(e) => setForm({ ...form, totalBill: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Discount</Label>
                                <Input
                                    type="number"
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
        try {
            await restock({
                id: product.id ?? product._id,
                price: Number(form.price),
                stockQty: Number(form.stockQty),
                totalBill: Number(form.totalBill),
                discount: Number(form.discount)
            }).unwrap()
            toast.success('Product restocked')
            onSuccess()
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Restock failed')
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
                        <Label>Price</Label>
                        <Input
                            type="number"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Stock Qty</Label>
                        <Input
                            type="number"
                            value={form.stockQty}
                            onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Total Bill</Label>
                        <Input
                            type="number"
                            value={form.totalBill}
                            onChange={(e) => setForm({ ...form, totalBill: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Discount</Label>
                        <Input
                            type="number"
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
