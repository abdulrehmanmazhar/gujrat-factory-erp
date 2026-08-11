import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useCreateCategoryMutation, useDeleteCategoryMutation, useUpdateCategoryMutation } from '@/redux/api/categoriesApi'
import type { Category, StockByUnit } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { formatStockByUnit } from '@/lib/stockByUnit'
import { cn } from '@/lib/utils'
import { ChevronRight, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export type CategoryFilter = 'all' | 'uncategorized' | string

function CategoryLabel({ name, productCount, stockByUnit }: { name: string; productCount?: number; stockByUnit?: StockByUnit[] }) {
    const stock = formatStockByUnit(stockByUnit)
    return (
        <>
            <span className="block truncate">
                {name}
                {typeof productCount === 'number' ? <span className="text-muted-foreground ml-1 text-xs">({productCount})</span> : null}
            </span>
            {stock ? <span className="text-muted-foreground block truncate text-[11px] leading-tight">{stock}</span> : null}
        </>
    )
}

export function flattenCategories(nodes: Category[], depth = 0): Array<Category & { depth: number }> {
    const result: Array<Category & { depth: number }> = []
    for (const node of nodes) {
        result.push({ ...node, depth })
        if (node.children?.length) result.push(...flattenCategories(node.children, depth + 1))
    }
    return result
}

function CategoryTreeNode({
    node,
    depth,
    selectedId,
    canWrite,
    canDelete,
    onSelect,
    onCreateChild,
    onRename,
    onDelete
}: {
    node: Category
    depth: number
    selectedId: CategoryFilter
    canWrite: boolean
    canDelete: boolean
    onSelect: (id: string) => void
    onCreateChild: (parentId: string) => void
    onRename: (category: Category) => void
    onDelete: (category: Category) => void
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
                        productCount={node.productCount}
                        stockByUnit={node.stockByUnit}
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
                                        <FolderPlus className="size-4" /> Add subcategory
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onRename(node)}>
                                        <Pencil className="size-4" /> Rename
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                            {canDelete ? (
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => onDelete(node)}>
                                    <Trash2 className="size-4" /> Delete
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

export function CategorySidebar({
    categories,
    selectedId,
    onSelect,
    canWrite,
    canDelete,
    labels,
    allMeta,
    uncategorizedMeta
}: {
    categories: Category[]
    selectedId: CategoryFilter
    onSelect: (id: CategoryFilter) => void
    canWrite: boolean
    canDelete: boolean
    allMeta?: { productCount: number; stockByUnit: StockByUnit[] }
    uncategorizedMeta?: { productCount: number; stockByUnit: StockByUnit[] }
    labels: {
        categories: string
        allProducts: string
        uncategorized: string
        addCategory: string
        categoryName: string
        parentCategory: string
        noParent: string
        createCategory: string
        renameCategory: string
    }
}) {
    const [createCategory, { isLoading: creating }] = useCreateCategoryMutation()
    const [updateCategory, { isLoading: updating }] = useUpdateCategoryMutation()
    const [deleteCategory] = useDeleteCategoryMutation()

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

    const openRename = (category: Category) => {
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

    const handleDelete = async (category: Category) => {
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
                                name={labels.allProducts}
                                productCount={allMeta?.productCount}
                                stockByUnit={allMeta?.stockByUnit}
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
                                productCount={uncategorizedMeta?.productCount}
                                stockByUnit={uncategorizedMeta?.stockByUnit}
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

export function collectDescendantIds(nodes: Category[], rootId: string): Set<string> {
    const byId = new Map<string, Category>()
    const walk = (list: Category[]) => {
        for (const node of list) {
            byId.set(node.id ?? node._id, node)
            if (node.children?.length) walk(node.children)
        }
    }
    walk(nodes)

    const result = new Set<string>()
    const stack = [rootId]
    while (stack.length) {
        const id = stack.pop()!
        if (result.has(id)) continue
        result.add(id)
        const node = byId.get(id)
        for (const child of node?.children ?? []) {
            stack.push(child.id ?? child._id)
        }
    }
    return result
}
