import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className
}: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}) {
    return (
        <div className={cn('relative w-full max-w-md', className)}>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="pl-9"
            />
        </div>
    )
}
