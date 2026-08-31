import { useMemo, useState } from 'react'
import { flattenCategories, type CategoryFilter } from '@/components/products/CategorySidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
    useCreateMiscExpenditureCategoryMutation,
    useDeleteMiscExpenditureCategoryMutation,
    useUpdateMiscExpenditureCategoryMutation
} from '@/redux/api/miscExpenditureApi'
import type { MiscExpenditureCategory } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { ChevronRight, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

function formatPkr(amount: number) {
    return `PKR ${amount.toLocaleString()}`
}

function CategoryLabel({ name, expenditureCount, expenditureTotal }: { name: string; expenditureCount?: number; expenditureTotal?: number }) {
    return (
        <>
            <span className="block truncate">
                {name}
                {typeof expenditureCount === 'number' ? <span className="text-muted-foreground ml-1 text-xs">({expenditureCount})</span> : null}
            </span>
            {typeof expenditureTotal === 'number' ? (
                <span className="text-muted-foreground block truncate text-[11px] leading-tight">{formatPkr(expenditureTotal)}</span>
            ) : null}
        </>
    )
}

function CategoryTreeNode({
    node,
    depth,
    selectedId,
    canWrite,
    canDelete,
    labels,
    onSelect,
    onCreateChild,
    onRename,
    onDelete
}: {
    node: MiscExpenditureCategory
    depth: number
    selectedId: CategoryFilter
    canWrite: boolean
    canDelete: boolean
    labels: { addSubcategory: string; renameCategory: string; deleteCategory: string }
    onSelect: (id: string) => void
    onCreateChild: (parentId: string) => void
    onRename: (category: MiscExpenditureCategory) => void
    onDelete: (category: MiscExpenditureCategory) => void
}) {
    const id = node.id ?? node._id
    const hasChildren = Boolean(node.children?.length)
    const [open, setOpen] = useState(depth < 2)
    const selected = selectedId === id

    return (
        <div>
            <div
                className={cn('group flex items-center gap-1 rounded-md px-1 py-0.5', selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}
                style={{ paddingLeft: `${8 + depth * 12}px` }}>
                {hasChildren ? (
                    <button
                        type="button"
                        className="hover:bg-background/60 inline-flex size-6 shrink-0 items-center justify-center rounded-md"
                        onClick={() => setOpen((v) => !v)}>
                        <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                    </button>
                ) : (
                    <span className="size-6 shrink-0" />
                )}
                <button
                    type="button"
                    className="min-w-0 flex-1 py-1 text-left text-sm"
                    onClick={() => onSelect(id)}>
                    <CategoryLabel
                        name={node.name}
                        expenditureCount={node.expenditureCount}
                        expenditureTotal={node.expenditureTotal}
                    />
                </button>
                {(canWrite || canDelete) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100">
                                <MoreHorizontal className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {canWrite ? (
                                <>
                                    <DropdownMenuItem onClick={() => onCreateChild(id)}>
                                        <FolderPlus className="size-4" /> {labels.addSubcategory}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onRename(node)}>
                                        <Pencil className="size-4" /> {labels.renameCategory}
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                            {canDelete ? (
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => onDelete(node)}>
                                    <Trash2 className="size-4" /> {labels.deleteCategory}
                                </DropdownMenuItem>
                            ) : null}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            {hasChildren && open
                ? node.children!.map((child) => (
                      <CategoryTreeNode
                          key={child.id ?? child._id}
                          node={child}
                          depth={depth + 1}
                          selectedId={selectedId}
                          canWrite={canWrite}
                          canDelete={canDelete}
                          labels={labels}
                          onSelect={onSelect}
                          onCreateChild={onCreateChild}
                          onRename={onRename}
                          onDelete={onDelete}
                      />
                  ))
                : null}
        </div>
    )
}

export function ExpenseCategorySidebar({
    categories,
    selectedId,
    onSelect,
    canWrite,
    canDelete,
    labels,
    allMeta,
    uncategorizedMeta
}: {
    categories: MiscExpenditureCategory[]
    selectedId: CategoryFilter
    onSelect: (id: CategoryFilter) => void
    canWrite: boolean
    canDelete: boolean
    allMeta?: { expenditureCount: number; expenditureTotal: number }
    uncategorizedMeta?: { expenditureCount: number; expenditureTotal: number }
    labels: {
        categories: string
        allExpenses: string
        uncategorized: string
        addCategory: string
        addSubcategory: string
        categoryName: string
        parentCategory: string
        noParent: string
        createCategory: string
        renameCategory: string
        deleteCategory: string
    }
}) {
    const [createCategory, { isLoading: creating }] = useCreateMiscExpenditureCategoryMutation()
    const [updateCategory, { isLoading: updating }] = useUpdateMiscExpenditureCategoryMutation()
    const [deleteCategory] = useDeleteMiscExpenditureCategoryMutation()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [mode, setMode] = useState<'create' | 'rename'>('create')
    const [name, setName] = useState('')
    const [parentId, setParentId] = useState<string>('none')
    const [editingId, setEditingId] = useState<string | null>(null)

    const flat = useMemo(() => flattenCategories(categories), [categories])

    const openCreate = (parent?: string | null) => {
        setMode('create')
        setName('')
        setParentId(parent || 'none')
        setEditingId(null)
        setDialogOpen(true)
    }

    const openRename = (category: MiscExpenditureCategory) => {
        setMode('rename')
        setName(category.name)
        setParentId(category.parentId || 'none')
        setEditingId(category.id ?? category._id)
        setDialogOpen(true)
    }

    const handleSave = async () => {
        const trimmed = name.trim()
        if (!trimmed) {
            toast.error('Enter a category name')
            return
        }
        try {
            if (mode === 'create') {
                await createCategory({
                    name: trimmed,
                    parentId: parentId === 'none' ? null : parentId
                }).unwrap()
                toast.success('Category created')
            } else if (editingId) {
                await updateCategory({
                    id: editingId,
                    name: trimmed,
                    parentId: parentId === 'none' ? null : parentId
                }).unwrap()
                toast.success('Category updated')
            }
            setDialogOpen(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not save category'))
        }
    }

    const handleDelete = async (category: MiscExpenditureCategory) => {
        try {
            await deleteCategory(category.id ?? category._id).unwrap()
            toast.success('Category deleted')
            if (selectedId === (category.id ?? category._id)) onSelect('all')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete category'))
        }
    }

    return (
        <>
            <aside className="bg-card flex w-full flex-col rounded-xl border sm:w-64 sm:shrink-0">
                <div className="flex items-center justify-between border-b px-3 py-2.5">
                    <h3 className="text-sm font-semibold">{labels.categories}</h3>
                    {canWrite ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => openCreate(null)}
                            title={labels.addCategory}>
                            <Plus className="size-4" />
                        </Button>
                    ) : null}
                </div>
                <ScrollArea className="h-[280px] sm:h-[calc(100vh-16rem)]">
                    <div className="space-y-0.5 p-2">
                        <button
                            type="button"
                            className={cn(
                                'w-full rounded-md px-2 py-1.5 text-left text-sm',
                                selectedId === 'all' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                            )}
                            onClick={() => onSelect('all')}>
                            <CategoryLabel
                                name={labels.allExpenses}
                                expenditureCount={allMeta?.expenditureCount}
                                expenditureTotal={allMeta?.expenditureTotal}
                            />
                        </button>
                        <button
                            type="button"
                            className={cn(
                                'w-full rounded-md px-2 py-1.5 text-left text-sm',
                                selectedId === 'uncategorized' ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                            )}
                            onClick={() => onSelect('uncategorized')}>
                            <CategoryLabel
                                name={labels.uncategorized}
                                expenditureCount={uncategorizedMeta?.expenditureCount}
                                expenditureTotal={uncategorizedMeta?.expenditureTotal}
                            />
                        </button>
                        <div className="bg-border my-2 h-px" />
                        {categories.map((node) => (
                            <CategoryTreeNode
                                key={node.id ?? node._id}
                                node={node}
                                depth={0}
                                selectedId={selectedId}
                                canWrite={canWrite}
                                canDelete={canDelete}
                                labels={labels}
                                onSelect={onSelect}
                                onCreateChild={(parent) => openCreate(parent)}
                                onRename={openRename}
                                onDelete={(cat) => void handleDelete(cat)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </aside>

            <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{mode === 'create' ? labels.createCategory : labels.renameCategory}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>{labels.categoryName}</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        void handleSave()
                                    }
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{labels.parentCategory}</Label>
                            <Select
                                value={parentId}
                                onValueChange={setParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={labels.noParent} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{labels.noParent}</SelectItem>
                                    {flat
                                        .filter((c) => (c.id ?? c._id) !== editingId)
                                        .map((c) => (
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
                                onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={creating || updating || !name.trim()}
                                onClick={() => void handleSave()}>
                                Save
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
