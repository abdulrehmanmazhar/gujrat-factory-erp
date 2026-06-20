// @ts-nocheck
import { desc, eq } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customers, transactions, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, withLegacyId } from '../utils/mappers.js'

export async function addCustomer(data: {
    name: string
    address: string
    contact: string
    route?: string
    businessName?: string
    createdById: string
}) {
    const [existing] = await db.select().from(customers).where(eq(customers.contact, data.contact)).limit(1)
    if (existing) throw new AppError('Account already exists for this contact', 400)

    const [customer] = await db
        .insert(customers)
        .values({
            id: createId(),
            name: data.name,
            address: data.address,
            contact: data.contact,
            route: data.route,
            businessName: data.businessName,
            createdById: data.createdById
        })
        .returning()

    return withLegacyId(customer)
}

export async function editCustomer(id: string, data: Partial<typeof customers.$inferInsert>) {
    const [existing] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!existing) throw new AppError('Customer with this id not found', 400)

    const [customer] = await db
        .update(customers)
        .set({ ...data, updatedAt: new Date() })
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
                email: users.email
            }
        })
        .from(customers)
        .leftJoin(users, eq(customers.createdById, users.id))
        .orderBy(desc(customers.createdAt))

    if (!rows.length) throw new AppError('No customers found', 404)

    return rows.map(({ customer, createdByUser }) => ({
        ...withLegacyId(customer),
        createdBy: customer.createdById,
        createdByUser: createdByUser ? withLegacyId(createdByUser) : { name: 'Unknown User', email: 'N/A' }
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
    const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)
    if (amount > customer.udhar) throw new AppError('Cannot pay more than udhar amount', 400)

    await db.insert(transactions).values({
        id: createId(),
        type: 'sale',
        amount,
        description: `${customer.name}-${customer.address} paid from his udhar ${customer.udhar}`,
        createdById
    })

    const newUdhar = customer.udhar - amount
    await db.update(customers).set({ udhar: newUdhar, updatedAt: new Date() }).where(eq(customers.id, id))
    return newUdhar
}
