import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddCustomerMutation, useEditCustomerMutation } from '@/redux/api/customersApi'
import type { Customer } from '@/types/api'
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
    onSuccess: () => void
}) {
    const [addCustomer, { isLoading: adding }] = useAddCustomerMutation()
    const [editCustomer, { isLoading: editing }] = useEditCustomerMutation()
    const [form, setForm] = useState({
        name: '',
        businessName: '',
        address: '',
        contact: '',
        route: ''
    })

    useEffect(() => {
        if (customer) {
            setForm({
                name: customer.name,
                businessName: customer.businessName ?? '',
                address: customer.address,
                contact: customer.contact,
                route: customer.route ?? ''
            })
        } else {
            setForm({ name: '', businessName: '', address: '', contact: '', route: '' })
        }
    }, [customer, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (customer) {
                await editCustomer({ id: customer.id ?? customer._id, ...form }).unwrap()
                toast.success('Customer updated')
            } else {
                await addCustomer(form).unwrap()
                toast.success('Customer added')
            }
            onSuccess()
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
                        <Label>Business Name</Label>
                        <Input
                            value={form.businessName}
                            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact</Label>
                        <Input
                            value={form.contact}
                            onChange={(e) => setForm({ ...form, contact: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Address</Label>
                        <Input
                            value={form.address}
                            onChange={(e) => setForm({ ...form, address: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Route</Label>
                        <Input
                            value={form.route}
                            onChange={(e) => setForm({ ...form, route: e.target.value })}
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
