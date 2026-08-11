import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LabelledAmount } from '@/types/api'
import { Plus, Trash2 } from 'lucide-react'

export function emptyLabelledAmount(): LabelledAmount {
    return { description: '', amount: '' }
}

export function parseLabelledAmountRows(rows: LabelledAmount[]) {
    return rows
        .map((row) => {
            const description = row.description.trim()
            const amount = Number(row.amount)
            if (!description || !Number.isFinite(amount) || amount <= 0) return null
            return { description, amount }
        })
        .filter(Boolean) as { description: string; amount: number }[]
}

export function LabelledAmountList({
    title,
    rows,
    onChange,
    descriptionPlaceholder = 'Description',
    amountPlaceholder = 'Amount'
}: {
    title: string
    rows: LabelledAmount[]
    onChange: (rows: LabelledAmount[]) => void
    descriptionPlaceholder?: string
    amountPlaceholder?: string
}) {
    const updateRow = (index: number, patch: Partial<LabelledAmount>) => {
        onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <Label>{title}</Label>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange([...rows, emptyLabelledAmount()])}>
                    <Plus className="size-3.5" /> Add
                </Button>
            </div>
            {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground">None added</p>
            ) : (
                <div className="space-y-2">
                    {rows.map((row, index) => (
                        <div
                            key={index}
                            className="flex gap-2">
                            <Input
                                value={row.description}
                                onChange={(e) => updateRow(index, { description: e.target.value })}
                                placeholder={descriptionPlaceholder}
                                className="flex-1"
                            />
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={row.amount}
                                onChange={(e) => updateRow(index, { amount: e.target.value })}
                                placeholder={amountPlaceholder}
                                className="w-28"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-destructive"
                                onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
