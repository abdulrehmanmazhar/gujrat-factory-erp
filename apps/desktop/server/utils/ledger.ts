// @ts-nocheck
import { eq } from 'drizzle-orm'
import { customers, suppliers } from '../models/tables.js'
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

/** Adjust supplier payable by delta (+ factory owes more, − factory owes less). */
export async function adjustSupplierPayable(
    dbConn: { select: typeof import('../utils/db.js').db.select; update: typeof import('../utils/db.js').db.update },
    supplierId: string,
    delta: number
) {
    const [supplier] = await dbConn.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1)
    if (!supplier) throw new AppError('Supplier not found', 404)

    const newPayable = Math.max((supplier.payable ?? 0) + delta, 0)
    await dbConn.update(suppliers).set({ payable: newPayable, updatedAt: new Date() }).where(eq(suppliers.id, supplierId))
    return newPayable
}

export function orderOutstanding(price: number, discount: number, paid: number, charges = 0) {
    return Math.max(Math.max(price + charges - discount, 0) - paid, 0)
}
