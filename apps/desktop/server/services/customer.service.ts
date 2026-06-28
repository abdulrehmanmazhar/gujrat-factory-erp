// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, customerTransactions, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'
import { adjustCustomerUdhar } from '../utils/ledger.js'
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

    if (!rows.length) throw new AppError('No customers found', 404)

    return rows.map(({ customer, createdByUser }) => ({
        ...withLegacyId(customer),
        createdBy: customer.createdById,
        createdByUser: createdByUser ? withLegacyId(createdByUser) : { name: 'Unknown User', contact: 'N/A' }
    }))
}

export async function getCustomerById(id: string) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)
    return withLegacyId(customer)
}

export async function deleteCustomer(id: string) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!customer) throw new AppError('Customer not found with this id', 400)
    await db.delete(customers).where(eq(customers.id, id))
}

export async function returnCustomerUdhar(id: string, amount: number, createdById: string) {
    return db.transaction(async (tx) => {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, id)).limit(1)
        if (!customer) throw new AppError('Customer not found', 404)
        if (amount > customer.udhar) throw new AppError('Cannot pay more than udhar amount', 400)

        await tx.insert(customerTransactions).values({
            id: createId(),
            customerId: id,
            type: 'udhar_payment',
            amount,
            description: `${customer.name}-${customer.address} paid from his udhar ${customer.udhar}`,
            createdById
        })

        return adjustCustomerUdhar(tx, id, -amount)
    })
}
