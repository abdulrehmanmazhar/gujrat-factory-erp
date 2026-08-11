import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddCustomerMutation, useEditCustomerMutation } from '@/redux/api/customersApi'
import type { Customer } from '@/types/api'
import { isValidWhatsAppContact, WHATSAPP_NUMBER_HINT } from '@/lib/phone'
import { toast } from 'sonner'

export function CustomerFormDialog({
    open,
    onOpenChange,
    customer,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    customer: Customer | null
    onSuccess: (saved?: Customer | null) => void
}) {
    const [addCustomer, { isLoading: adding }] = useAddCustomerMutation()
    const [editCustomer, { isLoading: editing }] = useEditCustomerMutation()
    const [form, setForm] = useState({
        name: '',
        address: '',
        contact: ''
    })

    useEffect(() => {
        if (customer) {
            setForm({
                name: customer.name,
                address: customer.address,
                contact: customer.contact
            })
        } else {
            setForm({ name: '', address: '', contact: '' })
        }
    }, [customer, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValidWhatsAppContact(form.contact)) {
            toast.error(`Enter a valid WhatsApp number (${WHATSAPP_NUMBER_HINT})`)
            return
        }
        try {
            if (customer) {
                const { customer: saved } = await editCustomer({ id: customer.id ?? customer._id, ...form }).unwrap()
                toast.success('Customer updated')
                onSuccess(saved)
            } else {
                const { customer: saved } = await addCustomer(form).unwrap()
                toast.success('Customer added')
                onSuccess(saved)
            }
        } catch (err) {
            toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Save failed')
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
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
                    <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={adding || editing}>
                            {customer ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
