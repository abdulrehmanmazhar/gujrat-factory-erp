// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, customerTransactions, orders, productSales, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { computeCustomerNet, computeCustomerOwed } from '../utils/ledger.js'
import { assertValidWhatsAppContact } from '../utils/phone.js'

export async function addCustomer(data: { name: string; address: string; contact: string; createdById: string }) {
    const contact = assertValidWhatsAppContact(data.contact, 'Contact')
    const [existing] = await db.select().from(customers).where(eq(customers.contact, contact)).limit(1)
    if (existing) throw new AppError('Account already exists for this contact', 400)

    const [customer] = await db
        .insert(customers)
        .values({
            id: createId(),
            name: data.name,
            address: data.address,
            contact,
            createdById: data.createdById
        })
        .returning()

    return withLegacyId(customer)
}

export async function editCustomer(id: string, data: Partial<typeof customers.$inferInsert>) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!existing) throw new AppError('Customer with this id not found', 400)

    const payload = { ...data }
    if (payload.contact) {
        payload.contact = assertValidWhatsAppContact(payload.contact, 'Contact')
        if (payload.contact !== existing.contact) {
            const [duplicate] = await db.select().from(customers).where(eq(customers.contact, payload.contact)).limit(1)
            if (duplicate) throw new AppError('Account already exists for this contact', 400)
        }
    }

    const [customer] = await db
        .update(customers)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning()

    return withLegacyId(customer)
}

export async function listCustomers() {
    const rows = await db
        .select({
            customer: customers,
            createdByUser: {
                id: users.id,
                name: users.name,
                contact: users.contact
            }
        })
        .from(customers)
        .leftJoin(users, eq(customers.createdById, users.id))
        .orderBy(desc(customers.createdAt))

    const txnRows = await db.select({ customerId: customerTransactions.customerId, type: customerTransactions.type, amount: customerTransactions.amount }).from(customerTransactions)
    const txnsByCustomer = new Map()
    for (const txn of txnRows) {
        const list = txnsByCustomer.get(txn.customerId) ?? []
        list.push(txn)
        txnsByCustomer.set(txn.customerId, list)
    }

    return rows.map(({ customer, createdByUser }) => {
        const txns = txnsByCustomer.get(customer.id) ?? []
        return {
            ...withLegacyId(customer),
            createdBy: customer.createdById,
            createdByUser: createdByUser ? withLegacyId(createdByUser) : { name: 'Unknown User', contact: 'N/A' },
            netAmount: computeCustomerNet(txns),
            owed: computeCustomerOwed(txns)
        }
    })
}

export async function getCustomerById(id: string) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)
    const txns = await db
        .select({ type: customerTransactions.type, amount: customerTransactions.amount })
        .from(customerTransactions)
        .where(eq(customerTransactions.customerId, id))
    return {
        ...withLegacyId(customer),
        netAmount: computeCustomerNet(txns),
        owed: computeCustomerOwed(txns)
    }
}

export async function deleteCustomer(id: string) {
    await db.transaction(async (tx) => {
        const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1)
        if (!customer) throw new AppError('Customer not found with this id', 404)

        // Orders own their line items. Delete the ledger rows first so no
        // customer financial history is retained after this irreversible action.
        await tx.delete(customerTransactions).where(eq(customerTransactions.customerId, id))
        await tx.delete(productSales).where(eq(productSales.customerId, id))
        await tx.delete(orders).where(eq(orders.customerId, id))
        await tx.delete(customers).where(eq(customers.id, id))
    })
}

export async function returnCustomerUdhar(id: string, amount: number, createdById: string) {
    return db.transaction(async (tx) => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).limit(1)
        if (!customer) throw new AppError('Customer not found', 404)

        const existingTxns = await tx
            .select({ type: customerTransactions.type, amount: customerTransactions.amount })
            .from(customerTransactions)
            .where(eq(customerTransactions.customerId, id))
        const owed = computeCustomerOwed(existingTxns)
        if (amount > owed) throw new AppError('Cannot pay more than outstanding balance', 400)

        await tx.insert(customerTransactions).values({
            id: createId(),
            customerId: id,
            type: 'udhar_payment',
            amount,
            description: `${customer.name}-${customer.address} paid outstanding balance ${owed}`,
            createdById
        })

        return computeCustomerOwed([...existingTxns, { type: 'udhar_payment', amount }])
    })
}
