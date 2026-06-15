import { useState, useEffect } from 'react'
import Header from '@/components/features/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EditIcon, Plus, Search, Play, ImageIcon, X, ExternalLink, MoreVertical, Trash2, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { TWorkflow } from '@/types/storage'
import { getStorageWorkflow, getWorkflowGraphById, setStorageWorkflows } from '@/utils/storage'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { platform } from '@/utils/platform'

export default function Home() {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [editMode, setEditMode] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [workflows, setWorkflows] = useState<TWorkflow>([])
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [workflowToDelete, setWorkflowToDelete] = useState<TWorkflow[0] | null>(null)

    const [newWorkflow, setNewWorkflow] = useState({
        id: '',
        name: '',
        description: '',
        createdAt: '',
        thumbnail: ''
    })

    // Load workflows from storage on mount
    useEffect(() => {
        loadWorkflows()
    }, [])

    const loadWorkflows = async () => {
        try {
            setLoading(true)
            const storedWorkflows = await getStorageWorkflow()
            setWorkflows(storedWorkflows || [])
        } catch (error) {
            console.error('Failed to load workflows:', error)
            setWorkflows([])
        } finally {
            setLoading(false)
        }
    }

    const saveWorkflows = async (updatedWorkflows: TWorkflow) => {
        try {
            await setStorageWorkflows(updatedWorkflows)
            setWorkflows(updatedWorkflows)
        } catch (error) {
            console.error('Failed to save workflows:', error)
        }
    }

    const openCreateModal = () => {
        setEditMode(false)
        setEditingId(null)
        setNewWorkflow({
            id: '',
            name: '',
            description: '',
            createdAt: '',
            thumbnail: ''
        })
        setOpen(true)
    }

    const openEditModal = (workflow: TWorkflow[0]) => {
        setEditMode(true)
        setEditingId(workflow.id)
        setNewWorkflow({
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            createdAt: workflow.createdAt,
            thumbnail: workflow.thumbnail || ''
        })
        setOpen(true)
    }

    const validateThumbnailUrl = (url: string) => {
        if (!url) return true
        try {
            const parsedUrl = new URL(url)
            return parsedUrl.protocol === 'https:' && url.match(/\.(jpeg|jpg|gif|png|webp)/i) !== null
        } catch {
            return false
        }
    }

    const handleCreateOrUpdate = async () => {
        if (!newWorkflow.name.trim()) return

        if (newWorkflow.thumbnail && !validateThumbnailUrl(newWorkflow.thumbnail)) {
            alert('Please enter a valid HTTPS URL ending with .jpg, .png, .gif, or .webp')
            return
        }

        if (editMode && editingId) {
            // Update existing workflow
            const updatedWorkflows = workflows.map((workflow) =>
                workflow.id === editingId
                    ? {
                          ...workflow,
                          name: newWorkflow.name,
                          description: newWorkflow.description,
                          thumbnail: newWorkflow.thumbnail
                      }
                    : workflow
            )
            await saveWorkflows(updatedWorkflows)
        } else {
            // Create new workflow
            const newWorkflowItem = {
                id: Date.now().toString(),
                name: newWorkflow.name,
                description: newWorkflow.description,
                createdAt: new Date().toISOString().split('T')[0],
                thumbnail: newWorkflow.thumbnail || ''
            }
            const updatedWorkflows = [...workflows, newWorkflowItem]
            await saveWorkflows(updatedWorkflows)
        }

        setNewWorkflow({ id: '', name: '', description: '', createdAt: '', thumbnail: '' })
        setOpen(false)
        setEditMode(false)
        setEditingId(null)
    }

    const handleDeleteClick = (workflow: TWorkflow[0]) => {
        setWorkflowToDelete(workflow)
        setDeleteDialogOpen(true)
    }

    const confirmDelete = async () => {
        if (workflowToDelete) {
            const updatedWorkflows = workflows.filter((w) => w.id !== workflowToDelete.id)
            await saveWorkflows(updatedWorkflows)
            setDeleteDialogOpen(false)
            setWorkflowToDelete(null)
        }
    }

    const handleExportWorkflow = async (workflow: TWorkflow[0]) => {
        try {
            const workflowGraph = await getWorkflowGraphById(workflow.id)

            const exportData = {
                ...workflow,
                graph: workflowGraph,
                exportDate: new Date().toISOString(),
                version: '1.0'
            }

            const jsonString = JSON.stringify(exportData, null, 2)
            const defaultFileName = `${workflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_workflow.json`

            const result = await platform.os.showSaveDialog('Export Workflow', {
                defaultPath: defaultFileName,
                filters: [
                    { name: 'JSON Files', extensions: ['json'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            })

            if (result) {
                await platform.filesystem.writeFile(result, jsonString)

                await platform.os.showNotification('Export Successful', `Workflow "${workflow.name}" exported successfully!`)
            }
        } catch (error) {
            console.error('Export failed:', error)
            await platform.os.showNotification('Export Failed', `Failed to export workflow: ${error.message || error}`)
        }
    }

    const filtered = workflows.filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))

    // Skeleton loader component
    const WorkflowSkeleton = () => (
        <Card className="rounded-2xl overflow-hidden border bg-background flex flex-col h-full">
            <div className="relative h-24 bg-muted border-b">
                <Skeleton className="w-full h-full" />
            </div>
            <CardHeader className="px-4 py-3 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
            </CardHeader>
            <CardContent className="px-4 pt-0 pb-4 flex flex-col flex-1">
                <div className="mt-auto flex items-center justify-between pt-4 border-t">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-16" />
                </div>
            </CardContent>
        </Card>
    )

    return (
        <div>
            <Header
                title="Dashboard"
                subtitle="Manage your recorded workflows"
                actions={
                    <Button onClick={openCreateModal}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Workflow
                    </Button>
                }
            />

            <div className="p-6 space-y-6">
                {/* Search */}
                <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Search workflows..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Cards with Loading State */}
                {loading ? (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <WorkflowSkeleton key={i} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-20 text-center text-sm text-muted-foreground">No workflows found.</div>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filtered.map((w) => (
                            <Card
                                key={w.id}
                                className="group rounded-2xl overflow-hidden border bg-background shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col h-full">
                                {/* Thumbnail Header */}
                                <div className="relative h-32 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-between px-4 border-b">
                                    {w.thumbnail ? (
                                        <>
                                            <img
                                                src={w.thumbnail}
                                                alt={w.name}
                                                className="absolute inset-0 w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.onerror = null // Prevent infinite loop
                                                    target.style.display = 'none'
                                                    // Show fallback
                                                    const parent = target.parentElement
                                                    if (parent) {
                                                        const fallback = document.createElement('div')
                                                        fallback.className = 'absolute inset-0 flex items-center justify-between px-4'
                                                        fallback.innerHTML = `
                                                            <div class="text-sm font-semibold relative z-10">WF</div>
                                                            <div class="flex items-center gap-2 relative z-10">
                                                                <span class="text-xs bg-secondary px-2 py-0.5 rounded-full">${w.createdAt}</span>
                                                            </div>
                                                        `
                                                        parent.appendChild(fallback)
                                                    }
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <ExternalLink className="w-5 h-5 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full flex items-center justify-between relative z-10">
                                            <div className="text-sm font-semibold">WF</div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs">
                                                    {w.createdAt}
                                                </Badge>
                                            </div>
                                        </div>
                                    )}

                                    {!w.thumbnail && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <Play className="w-20 h-20 text-foreground/5" />
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="px-4 py-3 space-y-1">
                                    <h3 className="font-semibold text-sm leading-none truncate">{w.name}</h3>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{w.description || 'No description'}</p>
                                </CardHeader>

                                {/* Flexible Content Area */}
                                <CardContent className="px-4 pt-0 pb-4 flex flex-col flex-1">
                                    {/* push footer down */}
                                    <div className="mt-auto flex items-center justify-between pt-4 border-t">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => openEditModal(w)}>
                                                    <EditIcon className="mr-2 h-4 w-4" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteClick(w)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleExportWorkflow(w)}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Export
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <Link to={`/recorder/${w.id}`}>
                                            <Button size="sm">Open</Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Create/Edit Workflow Modal with HTTPS URL Thumbnail */}
                <Dialog
                    open={open}
                    onOpenChange={setOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>{editMode ? 'Edit Workflow' : 'Create New Workflow'}</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Thumbnail URL Input Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Thumbnail URL (Optional)</label>
                                <div className="relative">
                                    <Input
                                        placeholder="https://example.com/thumbnail.jpg"
                                        value={newWorkflow.thumbnail}
                                        onChange={(e) => setNewWorkflow({ ...newWorkflow, thumbnail: e.target.value })}
                                        className="pl-9"
                                    />
                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>

                                {/* Thumbnail Preview */}
                                {newWorkflow.thumbnail && (
                                    <div className="relative group mt-2">
                                        <img
                                            src={newWorkflow.thumbnail}
                                            alt="Thumbnail preview"
                                            className="w-full h-32 object-cover rounded-lg border"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.onerror = null // Prevent infinite loop
                                                target.src = 'https://placehold.co/400x200/e2e8f0/64748b?text=Invalid+URL'
                                            }}
                                        />
                                        <button
                                            onClick={() => setNewWorkflow({ ...newWorkflow, thumbnail: '' })}
                                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="h-4 w-4" />
                                        </button>
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <ExternalLink className="h-3 w-3" />
                                            HTTPS URL only (jpg, png, gif, webp)
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Input
                                placeholder="Workflow name"
                                value={newWorkflow.name}
                                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                            />

                            <Textarea
                                placeholder="Short description..."
                                value={newWorkflow.description}
                                onChange={(e) =>
                                    setNewWorkflow({
                                        ...newWorkflow,
                                        description: e.target.value
                                    })
                                }
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateOrUpdate}
                                disabled={!newWorkflow.name.trim()}>
                                {editMode ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Delete Workflow</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete "{workflowToDelete?.name}"? This action cannot be undone.
                        </p>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmDelete}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
