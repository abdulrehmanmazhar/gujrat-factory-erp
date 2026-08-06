import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DateRangeFilter({
    from,
    to,
    onFromChange,
    onToChange,
    className
}: {
    from: string
    to: string
    onFromChange: (value: string) => void
    onToChange: (value: string) => void
    className?: string
}) {
    return (
        <div className={className ?? 'flex flex-wrap items-end gap-3'}>
            <div className="space-y-1">
                <Label htmlFor="filter-from">From</Label>
                <Input
                    id="filter-from"
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => onFromChange(e.target.value)}
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="filter-to">To</Label>
                <Input
                    id="filter-to"
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => onToChange(e.target.value)}
                />
            </div>
        </div>
    )
}

/** Inclusive local-day range against an ISO / Date-parsable timestamp. Empty bounds are ignored. */
export function isWithinDateRange(createdAt: string | Date | null | undefined, from: string, to: string) {
    if (!createdAt) return !(from || to)
    const value = createdAt instanceof Date ? createdAt : new Date(createdAt)
    if (Number.isNaN(value.getTime())) return false

    if (from) {
        const start = new Date(from)
        start.setHours(0, 0, 0, 0)
        if (value < start) return false
    }

    if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        if (value > end) return false
    }

    return true
}
