import { useState } from 'react'
import { RecipeFormDialog } from '@/components/recipes/RecipeFormDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { DataTable } from '@/components/shared/DataTable'
import { PageHeader, RowActions } from '@/components/shared/PageHeader'
import { SearchInput } from '@/components/shared/SearchInput'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/errors'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeleteRecipeMutation, useGetRecipesQuery } from '@/redux/api/recipesApi'
import type { Recipe } from '@/types/api'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

export default function RecipesPage() {
    const { canWrite, canDelete } = usePermissions()
    const { data, isLoading, refetch } = useGetRecipesQuery()
    const [deleteRecipe, { isLoading: deleting }] = useDeleteRecipeMutation()
    const [search, setSearch] = useState('')
    const [formOpen, setFormOpen] = useState(false)
    const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const filtered = (data?.recipes ?? []).filter((r) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return r.outputProduct?.name?.toLowerCase().includes(q) || (r.items ?? []).some((i) => i.product?.name?.toLowerCase().includes(q))
    })

    return (
        <div>
            <PageHeader
                title="Recipes"
                description="Define how much of each inventory item is consumed to produce another product"
                actions={
                    canWrite ? (
                        <Button
                            onClick={() => {
                                setEditRecipe(null)
                                setFormOpen(true)
                            }}>
                            <Plus className="size-4" /> Add recipe
                        </Button>
                    ) : null
                }
            />

            <div className="mb-4">
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search recipes..."
                />
            </div>

            <DataTable
                loading={isLoading}
                columns={[
                    {
                        key: 'outputProduct',
                        label: 'Produces',
                        render: (row) => (row.outputProduct as { name?: string })?.name ?? '—'
                    },
                    {
                        key: 'items',
                        label: 'Ingredients',
                        render: (row) => {
                            const items = (row.items as Recipe['items']) ?? []
                            return items.map((i) => `${i.product?.name ?? '?'} × ${i.qty}`).join(', ') || '—'
                        }
                    },
                    { key: 'notes', label: 'Notes', render: (row) => String(row.notes ?? '—') }
                ]}
                rows={filtered as unknown as Record<string, unknown>[]}
                renderActions={
                    canWrite || canDelete
                        ? (row) => (
                              <RowActions
                                  onEdit={
                                      canWrite
                                          ? () => {
                                                setEditRecipe(row as unknown as Recipe)
                                                setFormOpen(true)
                                            }
                                          : undefined
                                  }
                                  onDelete={canDelete ? () => setDeleteId(String(row.id ?? row._id)) : undefined}
                              />
                          )
                        : undefined
                }
            />

            <RecipeFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                recipe={editRecipe}
                onSuccess={refetch}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={() => setDeleteId(null)}
                title="Delete recipe?"
                onConfirm={async () => {
                    if (!deleteId) return
                    try {
                        await deleteRecipe(deleteId).unwrap()
                        toast.success('Recipe deleted')
                        setDeleteId(null)
                        refetch()
                    } catch (err) {
                        toast.error(getApiErrorMessage(err, 'Delete failed'))
                    }
                }}
                loading={deleting}
            />
        </div>
    )
}
