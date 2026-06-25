import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateLabourTransactionMutation, useGetLabourersQuery } from '@/redux/api/labourApi'
import type { LabourTransactionCategory } from '@/types/api'
import { toast } from 'sonner'

const CATEGORIES: { value: Exclude<LabourTransactionCategory, 'production'>; label: string }[] = [
    { value: 'advance', label: 'Advance' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'expense', label: 'Expense' },
    { value: 'other', label: 'Other' }
]

export function RecordLabourTransactionDialog({
    open,
    onOpenChange,
    onSuccess,
    defaultLabourerId
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    defaultLabourerId?: string
}) {
    const { data: labourersData } = useGetLabourersQuery()
    const [createTxn, { isLoading }] = useCreateLabourTransactionMutation()

    const [labourerId, setLabourerId] = useState('')
    const [category, setCategory] = useState<Exclude<LabourTransactionCategory, 'production'>>('expense')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const labourers = labourersData?.labourers?.filter((l) => l.isActive) ?? []

    useEffect(() => {
        if (!open) return
        setLabourerId(defaultLabourerId ?? '')
        setCategory('expense')
        setAmount('')
        setDescription('')
    }, [open, defaultLabourerId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const amt = Number(amount)
        if (!labourerId || !amt || amt <= 0 || !description.trim()) {
            toast.error('Fill all required fields with a valid amount')
            return
        }
        try {
            await createTxn({
                labourerId,
                amount: amt,
                category,
                description: description.trim()
            }).unwrap()
            toast.success('Labour transaction recorded')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to record transaction'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Record labour payment / expense</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Record advances, bonuses, expenses, or other labour-related payments outside production.
                    </p>

                    <div className="space-y-2">
                        <Label>Worker</Label>
                        <Select
                            value={labourerId}
                            onValueChange={setLabourerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select worker" />
                            </SelectTrigger>
                            <SelectContent>
                                {labourers.map((l) => (
                                    <SelectItem
                                        key={l.id ?? l._id}
                                        value={l.id ?? l._id}>
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                            value={category}
                            onValueChange={(v) => setCategory(v as typeof category)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((c) => (
                                    <SelectItem
                                        key={c.value}
                                        value={c.value}>
                                        {c.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Amount (PKR)</Label>
                        <Input
                            type="number"
                            min={1}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Weekly advance, transport allowance..."
                            rows={3}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={isLoading}>
                            Record
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
