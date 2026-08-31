import { useMemo, useState } from 'react'
import { RecordMiscExpenditureDialog } from '@/components/expenses/RecordMiscExpenditureDialog'
import { ExpenseCategorySidebar } from '@/components/expenses/ExpenseCategorySidebar'
import { collectDescendantIds, type CategoryFilter } from '@/components/products/CategorySidebar'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { DateRangeFilter, isWithinDateRange } from '@/components/shared/DateRangeFilter'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { getApiErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/hooks/useLanguage'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteMiscExpenditureMutation, useGetMiscExpenditureCategoriesQuery, useGetMiscExpendituresQuery } from '@/redux/api/miscExpenditureApi'
import type { MiscExpenditureCategory, MiscellaneousExpenditure } from '@/types/api'
import { ChevronRight, ExternalLink, Plus } from 'lucide-react'
import { toast } from 'sonner'

function formatDate(value?: string) {
    if (!value) return '—'
    return new Date(value).toLocaleString()
}

function formatPkr(amount: number) {
    return `PKR ${amount.toLocaleString()}`
}

function attachExpenseTotals(nodes: MiscExpenditureCategory[], expenditures: MiscellaneousExpenditure[]): MiscExpenditureCategory[] {
    const amountById = new Map<string, number>()
    const countById = new Map<string, number>()
    for (const item of expenditures) {
        const id = item.categoryId
        if (!id) continue
        amountById.set(id, (amountById.get(id) ?? 0) + item.amount)
        countById.set(id, (countById.get(id) ?? 0) + 1)
    }

    const walk = (node: MiscExpenditureCategory): MiscExpenditureCategory => {
        const children = (node.children ?? []).map(walk)
        const id = node.id ?? node._id
        let amount = amountById.get(id) ?? 0
        let count = countById.get(id) ?? 0
        for (const child of children) {
            amount += child.expenditureTotal ?? 0
            count += child.expenditureCount ?? 0
        }
        return { ...node, children, expenditureTotal: amount, expenditureCount: count }
    }

    return nodes.map(walk)
}

function expenseTableColumns() {
    return [
        {
            key: 'createdAt',
            label: 'Date',
            render: (row: Record<string, unknown>) => formatDate(String(row.createdAt ?? ''))
        },
        {
            key: 'category',
            label: 'Category',
            render: (row: Record<string, unknown>) => {
                const item = row as unknown as MiscellaneousExpenditure
                return item.category?.path ?? item.category?.name ?? '—'
            }
        },
        {
            key: 'amount',
            label: 'Amount (PKR)',
            render: (row: Record<string, unknown>) => Number(row.amount).toLocaleString()
        },
        {
            key: 'paymentMode',
            label: 'Payment',
            render: (row: Record<string, unknown>) => (
                <Badge variant={row.paymentMode === 'online' ? 'default' : 'secondary'}>
                    {String(row.paymentMode) === 'online' ? 'Online' : 'Cash'}
                </Badge>
            )
        },
        {
            key: 'note',
            label: 'Note',
            render: (row: Record<string, unknown>) => <span className="line-clamp-2 max-w-md">{String(row.note)}</span>
        },
        {
            key: 'proofImage',
            label: 'Proof',
            render: (row: Record<string, unknown>) =>
                row.proofImage ? (
                    <Button
                        asChild
                        variant="link"
                        className="h-auto p-0">
                        <a
                            href={String(row.proofImage)}
                            target="_blank"
                            rel="noopener noreferrer">
                            View
                            <ExternalLink className="ml-1 size-3.5" />
                        </a>
                    </Button>
                ) : (
                    '—'
                )
        },
        {
            key: 'createdBy',
            label: 'Recorded by',
            render: (row: Record<string, unknown>) => {
                const item = row as unknown as MiscellaneousExpenditure
                return item.createdBy?.name ?? '—'
            }
        }
    ]
}

function NestedExpenseGroups({
    nodes,
    expensesByCategory,
    uncategorized,
    depth = 0,
    canDelete,
    onDelete,
    emptyLabel
}: {
    nodes: MiscExpenditureCategory[]
    expensesByCategory: Map<string, MiscellaneousExpenditure[]>
    uncategorized: MiscellaneousExpenditure[]
    depth?: number
    canDelete: boolean
    onDelete: (id: string) => void
    emptyLabel: string
}) {
    const columns = expenseTableColumns()
    const renderActions = canDelete
        ? (row: Record<string, unknown>) => {
              const item = row as unknown as MiscellaneousExpenditure
              return <RowActions onDelete={() => onDelete(String(item.id ?? item._id))} />
          }
        : undefined

    return (
        <div className="space-y-2">
            {depth === 0 && uncategorized.length ? (
                <Collapsible
                    defaultOpen
                    className="rounded-xl border">
                    <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
                        <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                        <span className="truncate">Uncategorized</span>
                        <div className="ml-auto flex min-w-0 items-center gap-2">
                            <span className="text-muted-foreground truncate text-xs font-normal">
                                {formatPkr(uncategorized.reduce((sum, item) => sum + item.amount, 0))}
                            </span>
                            <Badge variant="secondary">{uncategorized.length}</Badge>
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="border-t px-2 pb-2 pt-2">
                        <DataTable
                            columns={columns}
                            rows={uncategorized as unknown as Record<string, unknown>[]}
                            renderActions={renderActions}
                        />
                    </CollapsibleContent>
                </Collapsible>
            ) : null}

            {nodes.map((node) => {
                const id = node.id ?? node._id
                const rows = expensesByCategory.get(id) ?? []
                const hasChildren = Boolean(node.children?.length)
                const isEmpty = !rows.length && !hasChildren
                return (
                    <Collapsible
                        key={id}
                        defaultOpen={depth < 2}
                        className="rounded-xl border">
                        <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
                            <ChevronRight className="size-4 transition-transform [[data-state=open]_&]:rotate-90" />
                            <span
                                className="truncate"
                                style={{ paddingLeft: `${depth * 4}px` }}>
                                {node.name}
                            </span>
                            <div className="ml-auto flex min-w-0 items-center gap-2">
                                <span className="text-muted-foreground truncate text-xs font-normal">{formatPkr(node.expenditureTotal ?? 0)}</span>
                                <Badge variant="secondary">{node.expenditureCount ?? rows.length}</Badge>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 border-t px-2 pb-2 pt-2">
                            {rows.length ? (
                                <DataTable
                                    columns={columns}
                                    rows={rows as unknown as Record<string, unknown>[]}
                                    renderActions={renderActions}
                                />
                            ) : isEmpty ? (
                                <p className="text-muted-foreground px-2 py-3 text-sm">{emptyLabel}</p>
                            ) : null}
                            {hasChildren ? (
                                <div className={cn('space-y-2', depth > 0 && 'ml-2')}>
                                    <NestedExpenseGroups
                                        nodes={node.children!}
                                        expensesByCategory={expensesByCategory}
                                        uncategorized={[]}
                                        depth={depth + 1}
                                        canDelete={canDelete}
                                        onDelete={onDelete}
                                        emptyLabel={emptyLabel}
                                    />
                                </div>
                            ) : null}
                        </CollapsibleContent>
                    </Collapsible>
                )
            })}
        </div>
    )
}

function findCategoryNode(nodes: MiscExpenditureCategory[], id: string): MiscExpenditureCategory | null {
    for (const node of nodes) {
        if ((node.id ?? node._id) === id) return node
        const child = findCategoryNode(node.children ?? [], id)
        if (child) return child
    }
    return null
}

export default function MiscellaneousExpenditurePage() {
    const { t } = useLanguage()
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetMiscExpendituresQuery()
    const { data: categoriesData } = useGetMiscExpenditureCategoriesQuery()
    const [deleteExpenditure, { isLoading: deleting }] = useDeleteMiscExpenditureMutation()

    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const expenditures = data?.expenditures ?? []
    const categories = categoriesData?.categories ?? []

    const dated = useMemo(() => expenditures.filter((item) => isWithinDateRange(item.createdAt, from, to)), [expenditures, from, to])

    const categoriesWithTotals = useMemo(() => attachExpenseTotals(categories, dated), [categories, dated])

    const filtered = useMemo(() => {
        const allowed =
            categoryFilter !== 'all' && categoryFilter !== 'uncategorized' ? collectDescendantIds(categoriesWithTotals, categoryFilter) : null

        return dated.filter((item) => {
            if (categoryFilter === 'uncategorized' && item.categoryId) return false
            if (allowed && (!item.categoryId || !allowed.has(item.categoryId))) return false
            if (!search.trim()) return true
            const q = search.toLowerCase()
            return (
                item.note.toLowerCase().includes(q) ||
                item.paymentMode.toLowerCase().includes(q) ||
                (item.category?.name ?? '').toLowerCase().includes(q) ||
                (item.category?.path ?? '').toLowerCase().includes(q) ||
                (item.createdBy?.name ?? '').toLowerCase().includes(q)
            )
        })
    }, [dated, search, categoryFilter, categoriesWithTotals])

    const totals = useMemo(() => {
        return filtered.reduce(
            (acc, item) => {
                acc.total += item.amount
                if (item.paymentMode === 'cash') acc.cash += item.amount
                else acc.online += item.amount
                return acc
            },
            { total: 0, cash: 0, online: 0 }
        )
    }, [filtered])

    const uncategorized = useMemo(() => filtered.filter((item) => !item.categoryId), [filtered])
    const expensesByCategory = useMemo(() => {
        const map = new Map<string, MiscellaneousExpenditure[]>()
        for (const item of filtered) {
            if (!item.categoryId) continue
            const list = map.get(item.categoryId) ?? []
            list.push(item)
            map.set(item.categoryId, list)
        }
        return map
    }, [filtered])

    const allMeta = useMemo(
        () => ({
            expenditureCount: dated.length,
            expenditureTotal: dated.reduce((sum, item) => sum + item.amount, 0)
        }),
        [dated]
    )
    const uncategorizedMeta = useMemo(() => {
        const items = dated.filter((item) => !item.categoryId)
        return {
            expenditureCount: items.length,
            expenditureTotal: items.reduce((sum, item) => sum + item.amount, 0)
        }
    }, [dated])

    const groupedRoots = useMemo(() => {
        if (categoryFilter === 'all' || categoryFilter === 'uncategorized') return categoriesWithTotals
        const node = findCategoryNode(categoriesWithTotals, categoryFilter)
        return node ? [node] : []
    }, [categoriesWithTotals, categoryFilter])

    const showGrouped = !search.trim() && categoryFilter !== 'uncategorized'

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await deleteExpenditure(deleteId).unwrap()
            toast.success('Expenditure deleted')
            setDeleteId(null)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete expenditure'))
        }
    }

    return (
        <div>
            <PageHeader
                title={t.miscExpenditure.title}
                description={t.miscExpenditure.description}
                actions={
                    canWrite ? (
                        <Button onClick={() => setFormOpen(true)}>
                            <Plus className="size-4" /> Record expenditure
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Total shown</p>
                    <p className="text-2xl font-semibold">{formatPkr(totals.total)}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Cash</p>
                    <p className="text-2xl font-semibold">{formatPkr(totals.cash)}</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Online</p>
                    <p className="text-2xl font-semibold">{formatPkr(totals.online)}</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <ExpenseCategorySidebar
                    categories={categoriesWithTotals}
                    selectedId={categoryFilter}
                    onSelect={setCategoryFilter}
                    canWrite={canWrite}
                    canDelete={canDelete}
                    allMeta={allMeta}
                    uncategorizedMeta={uncategorizedMeta}
                    labels={{
                        categories: t.miscExpenditure.categories,
                        allExpenses: t.miscExpenditure.allExpenses,
                        uncategorized: t.miscExpenditure.uncategorized,
                        addCategory: t.miscExpenditure.addCategory,
                        addSubcategory: t.miscExpenditure.addSubcategory,
                        categoryName: t.miscExpenditure.categoryName,
                        parentCategory: t.miscExpenditure.parentCategory,
                        noParent: t.miscExpenditure.noParent,
                        createCategory: t.miscExpenditure.createCategory,
                        renameCategory: t.miscExpenditure.renameCategory,
                        deleteCategory: t.miscExpenditure.deleteCategory
                    }}
                />

                <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                        <SearchInput
                            value={search}
                            onChange={setSearch}
                            placeholder={t.miscExpenditure.searchPlaceholder}
                        />
                        <DateRangeFilter
                            from={from}
                            to={to}
                            onFromChange={setFrom}
                            onToChange={setTo}
                        />
                    </div>

                    {showGrouped && (groupedRoots.length > 0 || uncategorized.length > 0) ? (
                        isLoading ? (
                            <DataTable
                                loading
                                columns={expenseTableColumns()}
                                rows={[]}
                            />
                        ) : (
                            <NestedExpenseGroups
                                nodes={groupedRoots}
                                expensesByCategory={expensesByCategory}
                                uncategorized={categoryFilter === 'all' ? uncategorized : []}
                                canDelete={canDelete}
                                onDelete={setDeleteId}
                                emptyLabel={t.miscExpenditure.emptyCategory}
                            />
                        )
                    ) : (
                        <DataTable
                            loading={isLoading}
                            columns={expenseTableColumns()}
                            rows={filtered as unknown as Record<string, unknown>[]}
                            renderActions={
                                canDelete
                                    ? (row) => {
                                          const item = row as unknown as MiscellaneousExpenditure
                                          return <RowActions onDelete={() => setDeleteId(String(item.id ?? item._id))} />
                                      }
                                    : undefined
                            }
                        />
                    )}
                </div>
            </div>

            <RecordMiscExpenditureDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                onSuccess={() => void refetch()}
            />

            <ConfirmDialog
                open={Boolean(deleteId)}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Delete expenditure?"
                description="This permanently removes the record and its proof image from storage."
                loading={deleting}
                onConfirm={() => void handleDelete()}
            />
        </div>
    )
}
