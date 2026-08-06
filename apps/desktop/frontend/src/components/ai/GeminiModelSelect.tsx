import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GeminiModelOption } from '@/redux/api/aiApi'

export function GeminiModelSelect({
    models,
    value,
    onValueChange,
    disabled,
    className
}: {
    models: GeminiModelOption[]
    value: string
    onValueChange: (modelId: string) => void
    disabled?: boolean
    className?: string
}) {
    const selected = models.find((m) => m.id === value)

    return (
        <Select
            value={value}
            onValueChange={onValueChange}
            disabled={disabled || models.length === 0}>
            <SelectTrigger className={className ?? 'w-[220px]'}>
                <SelectValue placeholder="Select Gemini model">{selected?.name ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
                {models.map((model) => (
                    <SelectItem
                        key={model.id}
                        value={model.id}>
                        <div className="flex flex-col gap-0.5">
                            <span>{model.name}</span>
                            {model.description ? <span className="text-xs text-muted-foreground">{model.description}</span> : null}
                        </div>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
