import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function PaginationControls({
    page,
    totalPages,
    onPrev,
    onNext
}: {
    page: number
    totalPages: number
    onPrev: () => void
    onNext: () => void
}) {
    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                disabled={page <= 1}>
                <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {page} of {Math.max(totalPages, 1)}
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={onNext}
                disabled={page >= totalPages}>
                <ChevronRight className="size-4" />
            </Button>
        </div>
    )
}

export function paginate<T>(items: T[], page: number, perPage: number) {
    const start = (page - 1) * perPage
    return items.slice(start, start + perPage)
}

export function totalPages(count: number, perPage: number) {
    return Math.ceil(count / perPage) || 1
}
