import { type ReactNode } from 'react'

export function OrderEntryShell({
    header,
    customer,
    products,
    items,
    details
}: {
    header: ReactNode
    customer: ReactNode
    products: ReactNode
    items: ReactNode
    details: ReactNode
}) {
    return (
        <div className="space-y-4">
            {header}
            <div className="mx-auto max-w-6xl">
                <section className="overflow-hidden rounded-lg border bg-card">
                    <div className="border-b px-4 py-3">{customer}</div>
                    <div className="grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
                        <div className="border-b lg:border-r lg:border-b-0">{products}</div>
                        <div className="min-w-0">
                            {items}
                            {details}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}
