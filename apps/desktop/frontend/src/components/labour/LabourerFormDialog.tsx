import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateLabourerMutation, useUpdateLabourerMutation } from '@/redux/api/labourApi'
import type { Labourer } from '@/types/api'
import { toast } from 'sonner'

export function LabourerFormDialog({
    open,
    onOpenChange,
    labourer,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    labourer: Labourer | null
    onSuccess: () => void
}) {
    const [createLabourer, { isLoading: creating }] = useCreateLabourerMutation()
    const [updateLabourer, { isLoading: updating }] = useUpdateLabourerMutation()
    const [form, setForm] = useState({ name: '', contact: '', notes: '' })

    useEffect(() => {
        if (labourer) {
            setForm({ name: labourer.name, contact: labourer.contact ?? '', notes: labourer.notes ?? '' })
        } else {
            setForm({ name: '', contact: '', notes: '' })
        }
    }, [labourer, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (labourer) {
                await updateLabourer({ id: labourer.id ?? labourer._id, ...form }).unwrap()
                toast.success('Worker updated')
            } else {
                await createLabourer(form).unwrap()
                toast.success('Worker added')
            }
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{labourer ? 'Edit worker' : 'Add worker'}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="space-y-3">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact</Label>
                        <Input
                            value={form.contact}
                            onChange={(e) => setForm({ ...form, contact: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            rows={2}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={creating || updating}>
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
