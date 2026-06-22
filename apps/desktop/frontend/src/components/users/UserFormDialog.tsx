import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function TargetFormDialog({
    open,
    onOpenChange,
    users,
    onSubmit,
    loading
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    users: { id: string; name: string }[]
    onSubmit: (payload: { userId: string; type: string; value: number; startDate: string; endDate: string }) => void
    loading?: boolean
}) {
    const [form, setForm] = useState({
        userId: '',
        type: 'sales',
        value: '',
        startDate: '',
        endDate: ''
    })

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Target</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        onSubmit({
                            userId: form.userId,
                            type: form.type,
                            value: Number(form.value),
                            startDate: form.startDate,
                            endDate: form.endDate
                        })
                    }}
                    className="space-y-3">
                    <div className="space-y-2">
                        <Label>User</Label>
                        <Select
                            value={form.userId}
                            onValueChange={(v) => setForm({ ...form, userId: v })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                                {users.map((u) => (
                                    <SelectItem
                                        key={u.id}
                                        value={u.id}>
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                            value={form.type}
                            onValueChange={(v) => setForm({ ...form, type: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="orders">Orders</SelectItem>
                                <SelectItem value="quantity">Quantity</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                            type="number"
                            value={form.value}
                            onChange={(e) => setForm({ ...form, value: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Start</Label>
                            <Input
                                type="date"
                                value={form.startDate}
                                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End</Label>
                            <Input
                                type="date"
                                value={form.endDate}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={loading}>
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
