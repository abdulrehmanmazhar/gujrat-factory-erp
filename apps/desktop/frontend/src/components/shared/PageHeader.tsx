import { Button } from '@/components/ui/button'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
    )
}

export function RowActions({
    onEdit,
    onDelete,
    deleteLabel = 'Delete',
    extra
}: {
    onEdit?: () => void
    onDelete?: () => void
    deleteLabel?: string
    extra?: React.ReactNode
}) {
    return (
        <div className="flex gap-1">
            {extra}
            {onEdit ? (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onEdit}>
                    Edit
                </Button>
            ) : null}
            {onDelete ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={onDelete}>
                    {deleteLabel}
                </Button>
            ) : null}
        </div>
    )
}
