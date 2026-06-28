// @ts-nocheck
import { eq } from 'drizzle-orm'
import { customers } from '../models/tables.js'
import { AppError } from './errors.js'

/** Adjust customer udhar by delta (+ increases balance owed, − decreases). */
export async function adjustCustomerUdhar(
    dbConn: { select: typeof import('../utils/db.js').db.select; update: typeof import('../utils/db.js').db.update },
    customerId: string,
    delta: number
) {
    const [customer] = await dbConn.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const newUdhar = Math.max((customer.udhar ?? 0) + delta, 0)
    await dbConn.update(customers).set({ udhar: newUdhar, updatedAt: new Date() }).where(eq(customers.id, customerId))
    return newUdhar
}

export function orderOutstanding(price: number, discount: number, paid: number) {
    return Math.max(Math.max(price - discount, 0) - paid, 0)
}
