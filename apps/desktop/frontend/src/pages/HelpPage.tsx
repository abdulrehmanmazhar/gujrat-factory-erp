import { PageHeader } from '@/components/shared/PageHeader'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HelpPage() {
    return (
        <div>
            <PageHeader
                title="Help"
                description="Frequently asked questions and support"
            />

            <Card>
                <CardHeader>
                    <CardTitle>FAQ</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion
                        type="single"
                        collapsible
                        className="w-full">
                        <AccordionItem value="orders">
                            <AccordionTrigger>How do I manage orders?</AccordionTrigger>
                            <AccordionContent>
                                Go to Orders to view all orders, record installment payments, issue partial refunds, and inspect cart details.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="payments">
                            <AccordionTrigger>How do partial payments and refunds work?</AccordionTrigger>
                            <AccordionContent>
                                On the Orders page, use Pay to collect outstanding balances in installments. Use Refund to return money to the
                                customer in chunks — total refunds cannot exceed what was paid on the order.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="inventory">
                            <AccordionTrigger>How do I restock products?</AccordionTrigger>
                            <AccordionContent>Open Inventory, click Restock on a product, and enter quantity and bill details.</AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    )
}
