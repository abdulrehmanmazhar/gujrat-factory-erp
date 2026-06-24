import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useGetProductsQuery } from '@/redux/api/productsApi'
import { useCreateRecipeMutation, useUpdateRecipeMutation } from '@/redux/api/recipesApi'
import type { Recipe } from '@/types/api'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

type IngredientLine = { ingredientProductId: string; qty: string; name?: string }

export function RecipeFormDialog({
    open,
    onOpenChange,
    recipe,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    recipe: Recipe | null
    onSuccess: () => void
}) {
    const { data: productsData } = useGetProductsQuery()
    const [createRecipe, { isLoading: creating }] = useCreateRecipeMutation()
    const [updateRecipe, { isLoading: updating }] = useUpdateRecipeMutation()

    const products = productsData?.products ?? []
    const [outputProductId, setOutputProductId] = useState('')
    const [notes, setNotes] = useState('')
    const [items, setItems] = useState<IngredientLine[]>([])
    const [addIngId, setAddIngId] = useState('')
    const [addQty, setAddQty] = useState('1')

    useEffect(() => {
        if (!open) return
        if (recipe) {
            setOutputProductId(recipe.outputProductId)
            setNotes(recipe.notes ?? '')
            setItems(
                (recipe.items ?? []).map((i) => ({
                    ingredientProductId: i.ingredientProductId,
                    qty: String(i.qty),
                    name: i.product?.name
                }))
            )
        } else {
            setOutputProductId('')
            setNotes('')
            setItems([])
        }
        setAddIngId('')
        setAddQty('1')
    }, [recipe, open])

    const addIngredient = () => {
        if (!addIngId) return
        const qty = Number(addQty)
        if (!qty || qty <= 0) {
            toast.error('Enter a valid quantity')
            return
        }
        if (addIngId === outputProductId) {
            toast.error('Output product cannot be an ingredient')
            return
        }
        const p = products.find((x) => (x.id ?? x._id) === addIngId)
        setItems((prev) => {
            const existing = prev.find((l) => l.ingredientProductId === addIngId)
            if (existing) {
                return prev.map((l) => (l.ingredientProductId === addIngId ? { ...l, qty: addQty, name: p?.name } : l))
            }
            return [...prev, { ingredientProductId: addIngId, qty: addQty, name: p?.name }]
        })
        setAddIngId('')
        setAddQty('1')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!outputProductId) {
            toast.error('Select output product')
            return
        }
        if (items.length === 0) {
            toast.error('Add at least one ingredient')
            return
        }
        const payload = {
            items: items.map((i) => ({ ingredientProductId: i.ingredientProductId, qty: Number(i.qty) })),
            notes: notes || undefined
        }
        try {
            if (recipe) {
                await updateRecipe({ id: recipe.id ?? recipe._id, ...payload }).unwrap()
                toast.success('Recipe updated')
            } else {
                await createRecipe({ outputProductId, ...payload }).unwrap()
                toast.success('Recipe created')
            }
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'))
        }
    }

    const usedIds = new Set([outputProductId, ...items.map((i) => i.ingredientProductId)])

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{recipe ? 'Edit recipe' : 'New recipe'}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <div className="space-y-2">
                        <Label>Output product (produced)</Label>
                        <Select
                            value={outputProductId}
                            onValueChange={setOutputProductId}
                            disabled={!!recipe}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                                {products.map((p) => (
                                    <SelectItem
                                        key={p.id ?? p._id}
                                        value={p.id ?? p._id}>
                                        {p.name} ({p.category})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Qty per 1 unit produced</p>
                    </div>

                    <div className="space-y-2 rounded-lg border p-3">
                        <Label>Ingredients consumed</Label>
                        {items.map((line) => (
                            <div
                                key={line.ingredientProductId}
                                className="flex items-center justify-between text-sm">
                                <span>
                                    {line.name ?? line.ingredientProductId} × {line.qty}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setItems((prev) => prev.filter((l) => l.ingredientProductId !== line.ingredientProductId))}>
                                    <Trash2 className="size-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <Select
                                value={addIngId}
                                onValueChange={setAddIngId}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Ingredient" />
                                </SelectTrigger>
                                <SelectContent>
                                    {products
                                        .filter((p) => !usedIds.has(p.id ?? p._id))
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
                                min={0.01}
                                step="0.01"
                                className="w-20"
                                value={addQty}
                                onChange={(e) => setAddQty(e.target.value)}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={addIngredient}>
                                <Plus className="size-4" />
                            </Button>
                        </div>
                    </div>

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
                            disabled={creating || updating}>
                            {recipe ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
