import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PaymentProofFields, usePaymentProofFields } from '@/components/shared/PaymentProofFields'
import { getApiErrorMessage } from '@/lib/errors'
import { useCreateCustomerKhataMutation, useCreateSupplierKhataMutation } from '@/redux/api/khataApi'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import { useGetSuppliersQuery } from '@/redux/api/suppliersApi'
import type { KhataDirection, KhataParty } from '@/types/api'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function directionHelp(party: KhataParty, direction: KhataDirection) {
    if (party === 'customer' && direction === 'in') {
        return 'Money received from customer — reduces their udhar. Cannot exceed current udhar.'
    }
    if (party === 'customer' && direction === 'out') {
        return 'Money paid out to customer — increases their udhar.'
    }
    if (party === 'supplier' && direction === 'out') {
        return 'Money paid to supplier — reduces payable. Cannot exceed current payable.'
    }
    return 'Refund received from supplier — increases payable.'
}

export function KhataTransactionDialog({
    open,
    onOpenChange,
    party,
    direction,
    onSuccess
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    party: KhataParty
    direction: KhataDirection
    onSuccess: () => void
}) {
    const { data: customersData } = useGetCustomersQuery(undefined, { skip: !open || party !== 'customer' })
    const { data: suppliersData } = useGetSuppliersQuery(true, { skip: !open || party !== 'supplier' })
    const [createCustomerEntry, { isLoading: savingCustomer }] = useCreateCustomerKhataMutation()
    const [createSupplierEntry, { isLoading: savingSupplier }] = useCreateSupplierKhataMutation()
    const proof = usePaymentProofFields(open)

    const [partyId, setPartyId] = useState('')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')

    const customers = customersData?.customers ?? []
    const suppliers = (suppliersData?.suppliers ?? []).filter((s) => s.isActive)

    const selectedBalance = useMemo(() => {
        if (party === 'customer') {
            const customer = customers.find((c) => (c.id ?? c._id) === partyId)
            return customer?.udhar ?? 0
        }
        const supplier = suppliers.find((s) => (s.id ?? s._id) === partyId)
        return supplier?.payable ?? 0
    }, [party, partyId, customers, suppliers])

    useEffect(() => {
        if (!open) return
        setPartyId('')
        setAmount('')
        setDescription('')
    }, [open, party, direction])

    const isLoading = savingCustomer || savingSupplier
    const title =
        party === 'customer'
            ? direction === 'in'
                ? 'Customer transaction In'
                : 'Customer transaction Out'
            : direction === 'in'
              ? 'Supplier transaction In'
              : 'Supplier transaction Out'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const parsedAmount = Number(amount)
        if (!partyId) {
            toast.error(party === 'customer' ? 'Select a customer' : 'Select a supplier')
            return
        }
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error('Enter a valid amount')
            return
        }

        try {
            const payload = {
                partyId,
                direction,
                amount: parsedAmount,
                description: description.trim() || undefined,
                paymentMode: proof.paymentMode,
                proofImage: proof.proofImage
            }
            if (party === 'customer') {
                await createCustomerEntry(payload).unwrap()
            } else {
                await createSupplierEntry(payload).unwrap()
            }
            toast.success('Khata entry recorded')
            onSuccess()
            onOpenChange(false)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Failed to record Khata entry'))
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
                    <p className="text-sm text-muted-foreground">{directionHelp(party, direction)}</p>

                    <div className="space-y-2">
                        <Label>{party === 'customer' ? 'Customer' : 'Supplier'}</Label>
                        <Select
                            value={partyId}
                            onValueChange={setPartyId}>
                            <SelectTrigger>
                                <SelectValue placeholder={party === 'customer' ? 'Select customer' : 'Select supplier'} />
                            </SelectTrigger>
                            <SelectContent>
                                {party === 'customer'
                                    ? customers.map((c) => {
                                          const id = c.id ?? c._id
                                          return (
                                              <SelectItem
                                                  key={id}
                                                  value={id}>
                                                  {c.name} (udhar PKR {(c.udhar ?? 0).toLocaleString()})
                                              </SelectItem>
                                          )
                                      })
                                    : suppliers.map((s) => {
                                          const id = s.id ?? s._id
                                          return (
                                              <SelectItem
                                                  key={id}
                                                  value={id}>
                                                  {s.name} (payable PKR {(s.payable ?? 0).toLocaleString()})
                                              </SelectItem>
                                          )
                                      })}
                            </SelectContent>
                        </Select>
                        {partyId ? <p className="text-xs text-muted-foreground">Current balance: PKR {selectedBalance.toLocaleString()}</p> : null}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="khata-amount">Amount (PKR)</Label>
                        <Input
                            id="khata-amount"
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="khata-note">Note (optional)</Label>
                        <Textarea
                            id="khata-note"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Optional note for this entry"
                        />
                    </div>

                    <PaymentProofFields
                        paymentMode={proof.paymentMode}
                        onPaymentModeChange={proof.setPaymentMode}
                        proofImage={proof.proofImage}
                        onProofImageChange={proof.setProofImage}
                    />

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
