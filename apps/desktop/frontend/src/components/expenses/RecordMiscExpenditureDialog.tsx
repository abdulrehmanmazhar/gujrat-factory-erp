import { useEffect, useMemo, useRef, useState } from 'react'
import { flattenCategories } from '@/components/products/CategorySidebar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useLanguage } from '@/hooks/useLanguage'
import {
    useCreateMiscExpenditureCategoryMutation,
    useCreateMiscExpenditureMutation,
    useGetMiscExpenditureCategoriesQuery
} from '@/redux/api/miscExpenditureApi'
import type { ExpenditurePaymentMode } from '@/types/api'
import { ImagePlus, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

export function RecordMiscExpenditureDialog({
    open,
    onOpenChange,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}) {
    const { t } = useLanguage()
    const { data: categoriesData } = useGetMiscExpenditureCategoriesQuery(undefined, { skip: !open })
    const [createCategory, { isLoading: creatingCategory }] = useCreateMiscExpenditureCategoryMutation()
    const [createExpenditure, { isLoading }] = useCreateMiscExpenditureMutation()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const categories = categoriesData?.categories ?? []
    const flatCategories = useMemo(() => flattenCategories(categories), [categories])
    const [amount, setAmount] = useState('')
    const [paymentMode, setPaymentMode] = useState<ExpenditurePaymentMode>('cash')
    const [categoryId, setCategoryId] = useState('')
    const [newCategoryName, setNewCategoryName] = useState('')
    const [newCategoryParentId, setNewCategoryParentId] = useState('none')
    const [addingCategory, setAddingCategory] = useState(false)
    const [note, setNote] = useState('')
    const [proofImage, setProofImage] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setAmount('')
        setPaymentMode('cash')
        setCategoryId('')
        setNewCategoryName('')
        setNewCategoryParentId('none')
        setAddingCategory(false)
        setNote('')
        setProofImage(null)
        setPreviewUrl(null)
    }, [open])

    useEffect(() => {
        if (!proofImage) {
            setPreviewUrl(null)
            return
        }
        const url = URL.createObjectURL(proofImage)
        setPreviewUrl(url)
        return () => URL.revokeObjectURL(url)
    }, [proofImage])

    const handleCreateCategory = async () => {
        const name = newCategoryName.trim()
        if (!name) {
            toast.error('Enter a category name')
            return
        }
        try {
            const { category } = await createCategory({
                name,
                parentId: newCategoryParentId === 'none' ? null : newCategoryParentId
            }).unwrap()
            const id = category.id ?? category._id
            setCategoryId(id)
            setNewCategoryName('')
            setNewCategoryParentId('none')
            setAddingCategory(false)
            toast.success('Category created')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not create category'))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const parsedAmount = Number(amount)
        if (!parsedAmount || parsedAmount <= 0 || !note.trim()) {
            toast.error('Enter a valid amount and note')
            return
        }
        if (!categoryId) {
            toast.error('Select a category')
            return
        }

        try {
            await createExpenditure({
                amount: parsedAmount,
                paymentMode,
                note: note.trim(),
                categoryId,
                proofImage
            }).unwrap()
            toast.success('Expenditure recorded')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to record expenditure'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Record miscellaneous expenditure</DialogTitle>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="expense-amount">Amount (PKR)</Label>
                        <Input
                            id="expense-amount"
                            type="number"
                            min={1}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label>Category</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => setAddingCategory((v) => !v)}>
                                <Plus className="size-3.5" />
                                {addingCategory ? 'Cancel' : t.miscExpenditure.newCategory}
                            </Button>
                        </div>
                        {addingCategory ? (
                            <div className="space-y-2">
                                <Input
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    placeholder="e.g. Utilities"
                                    autoFocus
                                />
                                <Select
                                    value={newCategoryParentId}
                                    onValueChange={setNewCategoryParentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={t.miscExpenditure.noParent} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t.miscExpenditure.noParent}</SelectItem>
                                        {flatCategories.map((c) => {
                                            const id = c.id ?? c._id
                                            return (
                                                <SelectItem
                                                    key={id}
                                                    value={id}>
                                                    {c.path ?? `${'—'.repeat(c.depth)} ${c.name}`}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    disabled={creatingCategory || !newCategoryName.trim()}
                                    onClick={() => void handleCreateCategory()}>
                                    Add
                                </Button>
                            </div>
                        ) : (
                            <Select
                                value={categoryId}
                                onValueChange={setCategoryId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={t.miscExpenditure.selectCategory} />
                                </SelectTrigger>
                                <SelectContent>
                                    {flatCategories.length === 0 ? (
                                        <SelectItem
                                            value="__none"
                                            disabled>
                                            {t.miscExpenditure.noCategoriesYet}
                                        </SelectItem>
                                    ) : (
                                        flatCategories.map((c) => {
                                            const id = c.id ?? c._id
                                            return (
                                                <SelectItem
                                                    key={id}
                                                    value={id}>
                                                    {c.path ?? c.name}
                                                </SelectItem>
                                            )
                                        })
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Payment mode</Label>
                        <Select
                            value={paymentMode}
                            onValueChange={(value) => setPaymentMode(value as ExpenditurePaymentMode)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="online">Online</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expense-note">Note</Label>
                        <Textarea
                            id="expense-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="What was this expense for?"
                            rows={3}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Proof image (optional)</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setProofImage(e.target.files?.[0] ?? null)}
                        />
                        {previewUrl ? (
                            <div className="relative overflow-hidden rounded-md border">
                                <img
                                    src={previewUrl}
                                    alt="Proof preview"
                                    className="max-h-40 w-full object-cover"
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="absolute top-2 right-2 size-7"
                                    onClick={() => {
                                        setProofImage(null)
                                        if (fileInputRef.current) fileInputRef.current.value = ''
                                    }}>
                                    <X className="size-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => fileInputRef.current?.click()}>
                                <ImagePlus className="mr-2 size-4" />
                                Upload receipt or proof
                            </Button>
                        )}
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
                            disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
