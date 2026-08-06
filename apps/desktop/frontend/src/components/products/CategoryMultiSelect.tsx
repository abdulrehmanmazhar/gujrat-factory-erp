import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateCategoryMutation, useGetCategoriesQuery } from '@/redux/api/categoriesApi'
import type { Category } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { Check, ChevronRight, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { flattenCategories } from '@/components/products/CategorySidebar'

function CategoryCheckNode({
    node,
    depth,
    selected,
    onToggle
}: {
    node: Category
    depth: number
    selected: Set<string>
    onToggle: (id: string) => void
}) {
    const id = node.id ?? node._id
    const hasChildren = Boolean(node.children?.length)
    const [open, setOpen] = useState(depth < 1)
    const isSelected = selected.has(id)

    return (
        <div>
            <div
                className="flex items-center gap-1"
                style={{ paddingLeft: `${depth * 12}px` }}>
                {hasChildren ? (
                    <button
                        type="button"
                        className="hover:bg-muted inline-flex size-6 items-center justify-center rounded-md"
                        onClick={() => setOpen((v) => !v)}>
                        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                    </button>
                ) : (
                    <span className="size-6" />
                )}
                <button
                    type="button"
                    className={cn(
                        'hover:bg-muted flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                        isSelected && 'bg-primary/10 text-primary'
                    )}
                    onClick={() => onToggle(id)}>
                    <span
                        className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded border',
                            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                        )}>
                        {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="truncate">{node.name}</span>
                </button>
            </div>
            {hasChildren && open ? (
                <div>
                    {node.children!.map((child) => (
                        <CategoryCheckNode
                            key={child.id ?? child._id}
                            node={child}
                            depth={depth + 1}
                            selected={selected}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}

export function CategoryMultiSelect({
    value,
    onChange,
    labels
}: {
    value: string[]
    onChange: (ids: string[]) => void
    labels: {
        selectCategories: string
        noCategoriesSelected: string
        createCategory: string
        categoryName: string
        parentCategory: string
        noParent: string
    }
}) {
    const { data } = useGetCategoriesQuery()
    const [createCategory, { isLoading: creating }] = useCreateCategoryMutation()
    const categories = data?.categories ?? []
    const flat = useMemo(() => flattenCategories(categories), [categories])
    const selected = useMemo(() => new Set(value), [value])
    const [pickerOpen, setPickerOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [name, setName] = useState('')
    const [parentId, setParentId] = useState('none')

    const selectedLabels = flat.filter((c) => selected.has(c.id ?? c._id))

    const toggle = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        onChange([...next])
    }

    const handleCreate = async () => {
        const trimmed = name.trim()
        if (!trimmed) {
            toast.error('Enter a category name')
            return
        }
        try {
            const { category } = await createCategory({
                name: trimmed,
                parentId: parentId === 'none' ? null : parentId
            }).unwrap()
            const id = category.id ?? category._id
            onChange([...new Set([...value, id])])
            setCreateOpen(false)
            setName('')
            setParentId('none')
            toast.success('Category created')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not create category'))
        }
    }

    return (
        <div className="space-y-2 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
                <Label>{labels.selectCategories}</Label>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCreateOpen(true)}>
                        <Plus className="size-3.5" /> {labels.createCategory}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPickerOpen((v) => !v)}>
                        {pickerOpen ? 'Done' : 'Choose'}
                    </Button>
                </div>
            </div>

            <div className="flex min-h-9 flex-wrap gap-1.5 rounded-lg border p-2">
                {selectedLabels.length ? (
                    selectedLabels.map((c) => {
                        const id = c.id ?? c._id
                        return (
                            <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 pr-1">
                                {c.path ?? c.name}
                                <button
                                    type="button"
                                    className="hover:bg-muted rounded-sm p-0.5"
                                    onClick={() => toggle(id)}>
                                    <X className="size-3" />
                                </button>
                            </Badge>
                        )
                    })
                ) : (
                    <span className="text-muted-foreground text-sm">{labels.noCategoriesSelected}</span>
                )}
            </div>

            {pickerOpen ? (
                <div className="bg-muted/30 max-h-48 overflow-y-auto rounded-lg border p-2">
                    {categories.length ? (
                        categories.map((node) => (
                            <CategoryCheckNode
                                key={node.id ?? node._id}
                                node={node}
                                depth={0}
                                selected={selected}
                                onToggle={toggle}
                            />
                        ))
                    ) : (
                        <p className="text-muted-foreground p-2 text-sm">No categories yet. Create one first.</p>
                    )}
                </div>
            ) : null}

            <Dialog
                open={createOpen}
                onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{labels.createCategory}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>{labels.categoryName}</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{labels.parentCategory}</Label>
                            <Select
                                value={parentId}
                                onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{labels.noParent}</SelectItem>
                                    {flat.map((c) => (
                                        <SelectItem
                                            key={c.id ?? c._id}
                                            value={c.id ?? c._id}>
                                            {'—'.repeat(c.depth)} {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={creating || !name.trim()}
                                onClick={() => void handleCreate()}>
                                Create
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
