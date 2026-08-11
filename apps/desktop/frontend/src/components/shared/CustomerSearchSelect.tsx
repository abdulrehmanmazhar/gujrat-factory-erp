import { useEffect, useMemo, useRef, useState } from 'react'
import { CustomerFormDialog } from '@/components/customers/CustomerFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePermissions } from '@/hooks/usePermissions'
import { useGetCustomersQuery } from '@/redux/api/customersApi'
import type { Customer } from '@/types/api'
import { cn } from '@/lib/utils'
import { Check, Plus, Search, UserRound, X } from 'lucide-react'

function customerId(c: Customer) {
    return c.id ?? c._id
}

function matchesQuery(c: Customer, q: string) {
    if (!q) return true
    return c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || (c.address ?? '').toLowerCase().includes(q)
}

function CustomerDetailsPanel({ customer }: { customer: Customer | undefined }) {
    if (!customer) {
        return (
            <div className="bg-muted/30 text-muted-foreground flex h-full min-h-[7.5rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                <UserRound className="size-5 opacity-50" />
                <span>Select a customer to see details</span>
            </div>
        )
    }

    const rows: { label: string; value: string }[] = [
        { label: 'Name', value: customer.name },
        { label: 'WhatsApp', value: customer.contact },
        { label: 'Address', value: customer.address || '—' },
        { label: 'Udhar', value: `PKR ${(customer.udhar ?? 0).toLocaleString()}` }
    ]
    if (customer.createdByUser?.name) {
        rows.push({ label: 'Created by', value: customer.createdByUser.name })
    }

    return (
        <div className="bg-muted/20 h-full min-h-[7.5rem] rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Customer details</p>
            <dl className="space-y-1.5">
                {rows.map((row) => (
                    <div
                        key={row.label}
                        className="grid grid-cols-[5.5rem_1fr] gap-2 text-sm">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="min-w-0 break-words font-medium">{row.value}</dd>
                    </div>
                ))}
            </dl>
        </div>
    )
}

export function CustomerSearchSelect({
    value,
    onChange,
    placeholder = 'Search customer by name, phone, or address…',
    allowCreate = true
}: {
    value: string
    onChange: (customerId: string) => void
    placeholder?: string
    allowCreate?: boolean
}) {
    const { canWrite } = usePermissions()
    const { data, isFetching, refetch } = useGetCustomersQuery(undefined, {
        refetchOnMountOrArgChange: true
    })
    const customers = data?.customers ?? []

    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [createOpen, setCreateOpen] = useState(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const skipSyncRef = useRef(false)

    const selected = customers.find((c) => customerId(c) === value)

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim()
        if (selected && search.trim() === selected.name) return customers
        return customers.filter((c) => matchesQuery(c, q))
    }, [customers, search, selected])

    useEffect(() => {
        if (skipSyncRef.current) {
            skipSyncRef.current = false
            return
        }
        if (selected) setSearch(selected.name)
        else if (!value) setSearch('')
    }, [selected, value])

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false)
                if (selected) setSearch(selected.name)
                else setSearch('')
            }
        }
        document.addEventListener('mousedown', onPointerDown)
        return () => document.removeEventListener('mousedown', onPointerDown)
    }, [open, selected])

    useEffect(() => {
        if (!open) return
        void refetch()
    }, [open, refetch])

    const handleSelect = (id: string) => {
        const customer = customers.find((c) => customerId(c) === id)
        onChange(id)
        skipSyncRef.current = true
        setSearch(customer?.name ?? '')
        setOpen(false)
    }

    const handleClear = () => {
        onChange('')
        skipSyncRef.current = true
        setSearch('')
        setOpen(false)
    }

    const handleCreated = (customer?: Customer | null) => {
        setCreateOpen(false)
        if (customer) {
            const id = customerId(customer)
            onChange(id)
            skipSyncRef.current = true
            setSearch(customer.name)
            setOpen(false)
        }
        void refetch()
    }

    return (
        <>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="flex items-start gap-2">
                    <div
                        ref={rootRef}
                        className="relative min-w-0 flex-1">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            value={search}
                            placeholder={placeholder}
                            className="pr-9 pl-9"
                            autoComplete="off"
                            onFocus={() => setOpen(true)}
                            onChange={(e) => {
                                const next = e.target.value
                                skipSyncRef.current = true
                                setSearch(next)
                                setOpen(true)
                                if (value && selected && next !== selected.name) onChange('')
                            }}
                        />
                        {value || search ? (
                            <button
                                type="button"
                                aria-label="Clear customer"
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1"
                                onClick={handleClear}>
                                <X className="size-3.5" />
                            </button>
                        ) : null}

                        {open ? (
                            <div className="bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-lg border shadow-md">
                                <div className="max-h-56 overflow-auto p-1">
                                    {isFetching && customers.length === 0 ? (
                                        <p className="text-muted-foreground px-2 py-3 text-sm">Loading customers…</p>
                                    ) : filtered.length === 0 ? (
                                        <p className="text-muted-foreground px-2 py-3 text-sm">
                                            {customers.length === 0 ? 'No customers yet' : 'No match for that search'}
                                        </p>
                                    ) : (
                                        filtered.map((c) => {
                                            const id = customerId(c)
                                            const isActive = value === id
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    className={cn(
                                                        'hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                                                        isActive && 'bg-accent'
                                                    )}
                                                    onClick={() => handleSelect(id)}>
                                                    <Check className={cn('mt-0.5 size-4 shrink-0', isActive ? 'opacity-100' : 'opacity-0')} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block font-medium">{c.name}</span>
                                                        <span className="text-muted-foreground block text-xs">
                                                            {c.contact}
                                                            {c.address ? ` · ${c.address}` : ''}
                                                        </span>
                                                    </span>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>

                                {allowCreate && canWrite && filtered.length === 0 ? (
                                    <div className="border-t p-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => {
                                                setOpen(false)
                                                setCreateOpen(true)
                                            }}>
                                            <Plus className="size-4" />
                                            Create customer
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    {allowCreate && canWrite ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                                setOpen(false)
                                setCreateOpen(true)
                            }}>
                            <Plus className="size-4" />
                            Create customer
                        </Button>
                    ) : null}
                </div>

                <CustomerDetailsPanel customer={selected} />
            </div>

            {allowCreate && canWrite ? (
                <CustomerFormDialog
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    customer={null}
                    onSuccess={handleCreated}
                />
            ) : null}
        </>
    )
}
