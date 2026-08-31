import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateLabourTransactionMutation, useGetLabourersQuery } from '@/redux/api/labourApi'
import type { KhataDirection, LabourTransactionCategory } from '@/types/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const OUT_CATEGORIES: { value: Exclude<LabourTransactionCategory, 'production' | 'income'>; label: string }[] = [
    { value: 'advance', label: 'Advance' },
    { value: 'bonus', label: 'Bonus' },
    { value: 'expense', label: 'Expense' },
    { value: 'other', label: 'Other' }
]

export type LabourAnalyticsTxnContext = {
    labourerId?: string | null
    direction?: KhataDirection
}

export function LabourAnalyticsTransactionDialog({
    open,
    onOpenChange,
    context,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    context: LabourAnalyticsTxnContext | null
    onSuccess: () => void
}) {
    const { data: labourersData } = useGetLabourersQuery(undefined, { skip: !open })
    const [createTxn, { isLoading }] = useCreateLabourTransactionMutation()

    const [labourerId, setLabourerId] = useState('')
    const [direction, setDirection] = useState<KhataDirection>('in')
    const [outCategory, setOutCategory] = useState<(typeof OUT_CATEGORIES)[number]['value']>('expense')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const labourers = labourersData?.labourers ?? []
    const labourerLocked = Boolean(context?.labourerId)
    const directionLocked = Boolean(context?.direction)

    useEffect(() => {
        if (!open) return
        setLabourerId(context?.labourerId ?? '')
        setDirection(context?.direction ?? 'in')
        setOutCategory('expense')
        setAmount('')
        setDescription('')
    }, [open, context])

    const title = direction === 'in' ? 'Standalone transaction In' : 'Standalone transaction Out'
    const help =
        direction === 'in'
            ? 'Records extra earnings for this worker that are not tied to a production log.'
            : 'Records money paid out to the worker (advance, bonus, expense, or other).'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const parsedAmount = Number(amount)
        if (!labourerId) {
            toast.error('Select a worker')
            return
        }
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error('Enter a valid amount')
            return
        }
        const note = description.trim() || (direction === 'in' ? 'Standalone labour income' : `${outCategory} payment`)
        try {
            await createTxn({
                labourerId,
                amount: parsedAmount,
                category: direction === 'in' ? 'income' : outCategory,
                description: note
            }).unwrap()
            toast.success(direction === 'in' ? 'Labour income recorded' : 'Labour payment recorded')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not record transaction'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-4">
                    <p className="text-muted-foreground text-sm">{help}</p>

                    <div className="space-y-2">
                        <Label>Worker</Label>
                        <Select
                            value={labourerId}
                            onValueChange={setLabourerId}
                            disabled={labourerLocked}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select worker" />
                            </SelectTrigger>
                            <SelectContent>
                                {labourers.map((labourer) => {
                                    const id = labourer.id ?? labourer._id
                                    return (
                                        <SelectItem
                                            key={id}
                                            value={id}>
                                            {labourer.name}
                                            {labourer.isActive ? '' : ' (inactive)'}
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Direction</Label>
                        <Select
                            value={direction}
                            onValueChange={(value) => setDirection(value as KhataDirection)}
                            disabled={directionLocked}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="in">In (earnings)</SelectItem>
                                <SelectItem value="out">Out (paid to worker)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {direction === 'out' ? (
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={outCategory}
                                onValueChange={(value) => setOutCategory(value as typeof outCategory)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OUT_CATEGORIES.map((category) => (
                                        <SelectItem
                                            key={category.value}
                                            value={category.value}>
                                            {category.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label htmlFor="labour-analytics-amount">Amount (PKR)</Label>
                        <Input
                            id="labour-analytics-amount"
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="labour-analytics-note">Note {direction === 'out' ? '' : '(optional)'}</Label>
                        <Textarea
                            id="labour-analytics-note"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder={direction === 'in' ? 'Optional note for this income' : 'e.g. Weekly advance, transport...'}
                            required={direction === 'out'}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
