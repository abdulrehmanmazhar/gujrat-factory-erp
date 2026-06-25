import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateSupplierMutation, useUpdateSupplierMutation } from '@/redux/api/suppliersApi'
import type { Supplier } from '@/types/api'
import { getApiErrorMessage } from '@/lib/errors'
import { isValidWhatsAppContact, WHATSAPP_NUMBER_HINT } from '@/lib/phone'
import { toast } from 'sonner'

export function SupplierFormDialog({
    open,
    onOpenChange,
    supplier,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplier: Supplier | null
    onSuccess: () => void
}) {
    const [createSupplier, { isLoading: creating }] = useCreateSupplierMutation()
    const [updateSupplier, { isLoading: updating }] = useUpdateSupplierMutation()
    const [form, setForm] = useState({
        name: '',
        contact: '',
        businessName: '',
        address: '',
        notes: ''
    })

    useEffect(() => {
        if (supplier) {
            setForm({
                name: supplier.name,
                contact: supplier.contact,
                businessName: supplier.businessName ?? '',
                address: supplier.address ?? '',
                notes: supplier.notes ?? ''
            })
        } else {
            setForm({ name: '', contact: '', businessName: '', address: '', notes: '' })
        }
    }, [supplier, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValidWhatsAppContact(form.contact)) {
            toast.error(`Enter a valid WhatsApp number (${WHATSAPP_NUMBER_HINT})`)
            return
        }
        try {
            if (supplier) {
                await updateSupplier({ id: supplier.id ?? supplier._id, ...form }).unwrap()
                toast.success('Supplier updated')
            } else {
                await createSupplier(form).unwrap()
                toast.success('Supplier created')
            }
            onSuccess()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Save failed'))
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
                </DialogHeader>
                <form
                    onSubmit={handleSubmit}
                    className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Name</Label>
                        <Input
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>WhatsApp number</Label>
                        <Input
                            type="tel"
                            value={form.contact}
                            onChange={(e) => setForm({ ...form, contact: e.target.value })}
                            placeholder="03XX XXXXXXX"
                            required
                        />
                        <p className="text-xs text-muted-foreground">{WHATSAPP_NUMBER_HINT}</p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Business Name</Label>
                        <Input
                            value={form.businessName}
                            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Address</Label>
                        <Input
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label>Notes</Label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            rows={3}
                        />
                    </div>
                    <DialogFooter className="sm:col-span-2">
                        <Button
                            type="submit"
                            disabled={creating || updating}>
                            {supplier ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
