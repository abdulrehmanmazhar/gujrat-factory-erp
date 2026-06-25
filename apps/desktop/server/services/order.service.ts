// @ts-nocheck

import { and, desc, eq, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '../utils/db.js'
import { customerTransactions, customers, orderItems, orders, products, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, mapOrderWithCart, withLegacyId } from '../utils/mappers.js'
import { logger } from '../config/logger.js'
import { formatWhatsAppContact } from '../utils/whatsapp.js'
import { readAppSettings } from '../utils/appSettings.js'
import { buildPaymentReminderWhatsAppMessage } from '../utils/documentI18n.js'
import { company } from './document.service.js'
import { adjustProductStock, findProductsByIds } from './product.service.js'

type CartInput = { productId: string; qty: number }[]
type OrderMode = 'pos' | 'delayed'

const SCHEDULER_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 5 * 60 * 1000)

function startOfToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
}

function buildPaymentReminderMessage(order: typeof orders.$inferSelect, customer: typeof customers.$inferSelect, outstanding: number) {
    return buildPaymentReminderWhatsAppMessage(readAppSettings().documentLanguage, order, customer, outstanding, company.phone)
}

async function findDraftOrder(customerId: string) {
    const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.customerId, customerId), or(isNull(orders.status), eq(orders.status, ''))))
        .limit(1)
    return order ?? null
}

async function getOrderItemsWithProducts(orderId: string) {
    const rows = await db
        .select({ item: orderItems, product: products })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, orderId))
        .orderBy(orderItems.createdAt)

    return rows.map(({ item, product }) => ({
        id: item.id,
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitDiscount: item.unitDiscount,
        product: withLegacyId(product)
    }))
}

async function upsertCartItems(orderId: string, cart: CartInput, productMap: Map<string, typeof products.$inferSelect>) {
    for (const { productId, qty } of cart) {
        const product = productMap.get(productId)
        if (!product) continue

        const [existing] = await db
            .select()
            .from(orderItems)
            .where(and(eq(orderItems.orderId, orderId), eq(orderItems.productId, productId)))
            .limit(1)

        if (existing) {
            await db
                .update(orderItems)
                .set({ qty: existing.qty + qty })
                .where(eq(orderItems.id, existing.id))
        } else {
            await db.insert(orderItems).values({
                id: createId(),
                orderId,
                productId,
                qty,
                unitPrice: product.price,
                unitDiscount: product.discount ?? 0
            })
        }
    }
}

async function deductOrderStock(orderId: string, customerId: string) {
    const items = await getOrderItemsWithProducts(orderId)
    for (const item of items) {
        await adjustProductStock(customerId, item.productId, item.qty, 'minus')
    }
    await db.update(orders).set({ stockDeducted: true, updatedAt: new Date() }).where(eq(orders.id, orderId))
}

async function restoreOrderStock(orderId: string, customerId: string) {
    const items = await getOrderItemsWithProducts(orderId)
    for (const item of items) {
        await adjustProductStock(customerId, item.productId, item.qty, 'add')
    }
    await db.update(orders).set({ stockDeducted: false, updatedAt: new Date() }).where(eq(orders.id, orderId))
}

async function processCart(customerId: string, createdById: string, cart: CartInput, deductStock: boolean) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 400)

    const productIds = cart.map((item) => item.productId)
    const productList = await findProductsByIds(productIds)
    if (productList.length !== productIds.length) throw new AppError('Some products not found', 400)

    const productMap = new Map(productList.map((p) => [p.id, p]))

    let order = await findDraftOrder(customerId)
    if (!order) {
        const [created] = await db
            .insert(orders)
            .values({ id: createId(), customerId, createdById, orderMode: 'delayed', stockDeducted: false })
            .returning()
        order = created
    }

    await upsertCartItems(order.id, cart, productMap)

    if (deductStock) {
        for (const { productId, qty } of cart) {
            await adjustProductStock(customerId, productId, qty, 'minus')
        }
        await db.update(orders).set({ stockDeducted: true, updatedAt: new Date() }).where(eq(orders.id, order.id))
    }

    const items = await getOrderItemsWithProducts(order.id)
    return mapOrderWithCart(order, items)
}

export async function createCart(customerId: string, createdById: string, cart: CartInput) {
    return processCart(customerId, createdById, cart, false)
}

function calculateOrderTotals(items: Awaited<ReturnType<typeof getOrderItemsWithProducts>>, additionalDiscount: number) {
    const price = items.reduce((acc, item) => acc + item.unitPrice * item.qty, 0)
    const discount = items.reduce((acc, item) => acc + item.unitDiscount * item.qty, 0) + additionalDiscount
    return { price, discount }
}

function orderPayable(price: number, discount: number) {
    return Math.max(price - discount, 0)
}

async function getNextOrderNumber() {
    const [last] = await db.select({ orderNumber: orders.orderNumber }).from(orders).orderBy(desc(orders.orderNumber)).limit(1)
    return last?.orderNumber ? last.orderNumber + 1 : 1
}

async function createSavedOrderDirect(customerId: string, createdById: string, cart: CartInput, orderMode: OrderMode) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 400)

    const productList = await findProductsByIds(cart.map((item) => item.productId))
    if (productList.length !== cart.length) throw new AppError('Some products not found', 400)

    const productMap = new Map(productList.map((p) => [p.id, p]))
    const [order] = await db
        .insert(orders)
        .values({
            id: createId(),
            customerId,
            createdById,
            orderMode,
            stockDeducted: false,
            status: ''
        })
        .returning()

    await upsertCartItems(order.id, cart, productMap)
    return order
}

async function queueOrderInvoice(orderId: string) {
    const { queueOrderInvoiceWhatsApp } = await import('./invoice.service.js')
    await queueOrderInvoiceWhatsApp(orderId)
}

async function recordPaymentTransaction(
    orderId: string,
    customerId: string,
    payment: number,
    userId: string,
    type: 'sale' | 'refund' = 'sale',
    description?: string
) {
    if (payment <= 0) return null

    const [txn] = await db
        .insert(customerTransactions)
        .values({
            id: createId(),
            customerId,
            orderId,
            type,
            amount: payment,
            description: description ?? (type === 'refund' ? 'Order refund' : 'Sales from order'),
            createdById: userId
        })
        .returning()

    if (type === 'sale') {
        const { queueTransactionReceiptWhatsApp } = await import('./receipt.service.js')
        await queueTransactionReceiptWhatsApp(txn.id)
    }
    return txn
}

async function applyOrderRefund(orderId: string, refundAmount: number, userId: string, description?: string) {
    if (refundAmount <= 0) return null

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)

    const paid = order.payment ?? 0
    const alreadyRefunded = order.refunded ?? 0
    const refundable = paid - alreadyRefunded
    if (refundAmount > refundable) {
        throw new AppError(`Refund cannot exceed refundable amount (${refundable})`, 400)
    }

    const [updated] = await db
        .update(orders)
        .set({ refunded: alreadyRefunded + refundAmount, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning()

    await recordPaymentTransaction(orderId, order.customerId, refundAmount, userId, 'refund', description)
    return withLegacyId(updated)
}

async function applyOrderPayment(orderId: string, payment: number, userId: string, markDelivered: boolean) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)

    const payable = orderPayable(order.price ?? 0, order.discount ?? 0)
    const alreadyPaid = order.payment ?? 0
    if (alreadyPaid + payment > payable) throw new AppError('Cannot pay more than remaining amount', 400)

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const newPaid = alreadyPaid + payment
    const remainingAfter = payable - newPaid
    const newUdhar = Math.max((customer.udhar || 0) + remainingAfter, 0)

    const [updatedOrder] = await db
        .update(orders)
        .set({
            payment: newPaid,
            deliveryStatus: markDelivered ? true : order.deliveryStatus,
            updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()

    if (payment > 0) await recordPaymentTransaction(orderId, order.customerId, payment, userId)

    await db.update(customers).set({ udhar: newUdhar, updatedAt: new Date() }).where(eq(customers.id, customer.id))
    return withLegacyId(updatedOrder)
}

async function finalizeOrder(
    orderId: string,
    customerId: string,
    deliveryDate: string,
    message: string,
    additionalDiscount: number,
    orderMode: OrderMode,
    initialPayment?: number,
    userId?: string
) {
    const items = await getOrderItemsWithProducts(orderId)
    const { price, discount } = calculateOrderTotals(items, additionalDiscount)
    const delivery = new Date(deliveryDate)
    delivery.setUTCHours(0, 0, 0, 0)

    const isPos = orderMode === 'pos'

    const [order] = await db
        .update(orders)
        .set({
            orderNumber: await getNextOrderNumber(),
            deliveryDate: delivery,
            message,
            status: 'saved',
            orderMode,
            price,
            discount,
            deliveryStatus: isPos,
            updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()

    if (isPos) {
        await deductOrderStock(orderId, customerId)
        if (typeof initialPayment === 'number' && initialPayment > 0 && userId) {
            await applyOrderPayment(orderId, initialPayment, userId, true)
        }
    } else if (typeof initialPayment === 'number' && initialPayment > 0 && userId) {
        await applyOrderPayment(orderId, initialPayment, userId, false)
    }

    await queueOrderInvoice(orderId)
    return order
}

export async function createOrder(
    customerId: string,
    createdById: string,
    cart: CartInput,
    deliveryDate: string,
    message = '',
    additionalDiscount = 0,
    orderMode: OrderMode = 'delayed',
    payment = 0
) {
    if (!deliveryDate) throw new AppError('Missing required fields', 400)

    if (orderMode === 'pos') {
        const order = await createSavedOrderDirect(customerId, createdById, cart, 'pos')
        await finalizeOrder(order.id, customerId, deliveryDate, message, additionalDiscount, 'pos', payment, createdById)
        return { message: 'POS order saved successfully' }
    }

    const order = await processCart(customerId, createdById, cart, false)
    await finalizeOrder(order.id, customerId, deliveryDate, message, additionalDiscount, 'delayed', payment, createdById)
    return { message: 'Order saved successfully' }
}

export async function deleteCartItem(orderId: string, index: number) {
    const items = await getOrderItemsWithProducts(orderId)
    const cartItem = items[index]
    if (!cartItem) throw new AppError('Cart item not found', 400)

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 400)
    if (order.stockDeducted) await adjustProductStock(order.customerId, cartItem.productId, cartItem.qty, 'add')

    await db.delete(orderItems).where(eq(orderItems.id, cartItem.id))
}

export async function addOrder(orderId: string, deliveryDate: string, message = '', additionalDiscount = 0) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 400)
    if (!deliveryDate) throw new AppError('Missing required fields', 400)

    await finalizeOrder(orderId, order.customerId, deliveryDate, message, additionalDiscount, 'delayed')
    return { message: 'Order saved successfully' }
}

export async function cancelOrder(orderId: string, refundAmount: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.status === 'cancelled') throw new AppError('Order is already cancelled', 400)
    if (order.deliveryStatus) throw new AppError('Delivered orders cannot be cancelled', 400)
    if (order.returnedAt) throw new AppError('Returned orders cannot be cancelled', 400)
    if (refundAmount < 0) throw new AppError('Refund amount must be non-negative', 400)

    const paid = order.payment ?? 0
    const alreadyRefunded = order.refunded ?? 0
    if (refundAmount > paid - alreadyRefunded) {
        throw new AppError('Refund cannot exceed amount paid minus refunds already issued', 400)
    }

    if (order.stockDeducted) await restoreOrderStock(orderId, order.customerId)

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const payable = orderPayable(order.price ?? 0, order.discount ?? 0)
    const outstandingFromOrder = Math.max(0, payable - paid)
    const newUdhar = Math.max((customer.udhar || 0) - outstandingFromOrder, 0)

    const [updated] = await db
        .update(orders)
        .set({
            status: 'cancelled',
            updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()

    await db.update(customers).set({ udhar: newUdhar, updatedAt: new Date() }).where(eq(customers.id, customer.id))

    if (refundAmount > 0) {
        await applyOrderRefund(orderId, refundAmount, userId, 'Refund on order cancellation')
    }

    const items = await getOrderItemsWithProducts(orderId)
    const [fresh] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    return mapOrderWithCart(fresh ?? updated, items)
}

export async function returnOrder(orderId: string, refundAmount: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.status === 'cancelled') throw new AppError('Cancelled orders cannot be returned', 400)
    if (!order.deliveryStatus) throw new AppError('Only delivered orders can be returned', 400)
    if (order.returnedAt) throw new AppError('Order has already been returned', 400)
    if (refundAmount < 0) throw new AppError('Refund amount must be non-negative', 400)

    const paid = order.payment ?? 0
    const alreadyRefunded = order.refunded ?? 0
    if (refundAmount > paid - alreadyRefunded) {
        throw new AppError('Refund cannot exceed amount paid minus refunds already issued', 400)
    }

    if (order.stockDeducted) await restoreOrderStock(orderId, order.customerId)

    const [updated] = await db
        .update(orders)
        .set({
            returnedAt: new Date(),
            status: 'returned',
            updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()

    if (refundAmount > 0) {
        await applyOrderRefund(orderId, refundAmount, userId, 'Refund on order return')
    }

    const items = await getOrderItemsWithProducts(orderId)
    const [fresh] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    return mapOrderWithCart(fresh ?? updated, items)
}

export async function getOrder(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    const items = await getOrderItemsWithProducts(orderId)
    return mapOrderWithCart(order, items)
}

export async function listOrders() {
    const allOrders = await db
        .select()
        .from(orders)
        .where(inArray(orders.status, ['saved', 'cancelled', 'returned']))
        .orderBy(desc(orders.createdAt))

    if (!allOrders.length) throw new AppError('No orders found', 404)

    return Promise.all(
        allOrders.map(async (order) => {
            const [userDetails] = await db
                .select({ id: users.id, name: users.name, contact: users.contact })
                .from(users)
                .where(eq(users.id, order.createdById))
                .limit(1)
            const [customerDetails] = await db
                .select({ id: customers.id, name: customers.name, contact: customers.contact })
                .from(customers)
                .where(eq(customers.id, order.customerId))
                .limit(1)
            const items = await getOrderItemsWithProducts(order.id)

            return {
                ...mapOrderWithCart(order, items),
                orderMode: order.orderMode,
                stockDeducted: order.stockDeducted,
                returnedAt: order.returnedAt,
                userDetails: userDetails ? withLegacyId(userDetails) : { name: 'Unknown User', contact: 'N/A' },
                customerDetails: customerDetails ? withLegacyId(customerDetails) : { name: 'Unknown Customer', contact: 'N/A' }
            }
        })
    )
}

export async function addOrderPayment(orderId: string, payment: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.status === 'cancelled') throw new AppError('Cancelled orders cannot accept payments', 400)
    if (order.returnedAt) throw new AppError('Returned orders cannot accept payments', 400)
    if (payment <= 0) throw new AppError('Payment must be positive', 400)

    const payable = orderPayable(order.price ?? 0, order.discount ?? 0)
    const outstanding = payable - (order.payment ?? 0)
    if (outstanding <= 0) throw new AppError('This order is already fully paid', 400)
    if (payment > outstanding) throw new AppError('Cannot pay more than the remaining amount', 400)

    return applyOrderPayment(orderId, payment, userId, order.orderMode === 'pos')
}

export async function recordOrderRefund(orderId: string, refundAmount: number, userId: string, notes?: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (refundAmount <= 0) throw new AppError('Refund amount must be positive', 400)

    const updated = await applyOrderRefund(orderId, refundAmount, userId, notes?.trim() || 'Order refund installment')
    const items = await getOrderItemsWithProducts(orderId)
    return mapOrderWithCart(updated, items)
}

export async function returnOrderUdhar(orderId: string, payment: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.status === 'cancelled') throw new AppError('Cancelled orders cannot accept payments', 400)
    if (order.payment === null || order.payment === undefined) throw new AppError("Cannot modify this order's payment", 400)
    if (order.returnedAt) throw new AppError('Returned orders cannot accept payments', 400)

    const totalPayable = orderPayable(order.price ?? 0, order.discount ?? 0)
    if ((order.payment ?? 0) >= totalPayable) throw new AppError('This order is already fully paid', 400)

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const remainingAmount = totalPayable - (order.payment ?? 0)
    if (payment > remainingAmount) throw new AppError('Cannot pay more than the remaining amount', 400)
    if (payment > customer.udhar) throw new AppError("Cannot pay more than customer's udhar amount", 400)
    if (payment === 0 && order.payment === 0) throw new AppError('Payment has already been recorded as zero', 400)

    const [txn] = await db
        .insert(customerTransactions)
        .values({
            id: createId(),
            customerId: customer.id,
            orderId,
            type: 'udhar_payment',
            amount: payment,
            description: `${customer.name} (${customer.address}) paid from their udhar: ${customer.udhar}`,
            createdById: userId
        })
        .returning()

    await db
        .update(customers)
        .set({ udhar: Math.max(customer.udhar - payment, 0), updatedAt: new Date() })
        .where(eq(customers.id, customer.id))

    const [updated] = await db
        .update(orders)
        .set({ payment: (order.payment ?? 0) + payment, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning()

    const { queueTransactionReceiptWhatsApp } = await import('./receipt.service.js')
    await queueTransactionReceiptWhatsApp(txn.id)

    return withLegacyId(updated)
}

export async function processDueDeliveries() {
    const today = new Date()
    today.setUTCHours(23, 59, 59, 999)

    const dueOrders = await db
        .select()
        .from(orders)
        .where(
            and(
                eq(orders.status, 'saved'),
                eq(orders.orderMode, 'delayed'),
                eq(orders.stockDeducted, false),
                isNull(orders.returnedAt),
                lte(orders.deliveryDate, today)
            )
        )

    for (const order of dueOrders) {
        try {
            await deductOrderStock(order.id, order.customerId)
            await db.update(orders).set({ deliveryStatus: true, updatedAt: new Date() }).where(eq(orders.id, order.id))
            logger.info('Delayed order delivered and stock deducted', { meta: { orderId: order.id, orderNumber: order.orderNumber } })
        } catch (error) {
            logger.error('Failed processing due delivery', { meta: { orderId: order.id, error } })
        }
    }
}

export async function processPaymentReminders() {
    const todayStart = startOfToday()

    const rows = await db
        .select({ order: orders, customer: customers })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(and(eq(orders.status, 'saved'), eq(orders.deliveryStatus, true), isNull(orders.returnedAt)))

    const { enqueueWhatsAppText } = await import('../utils/whatsappQueue.js')
    let sent = 0

    for (const { order, customer } of rows) {
        const payable = orderPayable(order.price ?? 0, order.discount ?? 0)
        const paid = order.payment ?? 0
        const outstanding = payable - paid

        if (outstanding <= 0) continue
        if (order.lastPaymentReminderAt && order.lastPaymentReminderAt >= todayStart) continue

        const contact = formatWhatsAppContact(customer.contact)
        if (!contact) {
            logger.info('Skipping payment reminder — customer has no valid WhatsApp contact', {
                meta: { orderId: order.id, customerId: customer.id }
            })
            continue
        }

        try {
            const message = buildPaymentReminderMessage(order, customer, outstanding)
            await enqueueWhatsAppText(contact, message)
            await db.update(orders).set({ lastPaymentReminderAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, order.id))
            sent += 1
            logger.info('Payment reminder queued', {
                meta: { orderId: order.id, orderNumber: order.orderNumber, outstanding }
            })
        } catch (error) {
            logger.error('Failed to queue payment reminder', { meta: { orderId: order.id, error } })
        }
    }

    if (sent > 0) {
        logger.info('Payment reminders processed', { meta: { sent } })
    }
}

export function runScheduler() {
    const tick = async () => {
        try {
            await processDueDeliveries()
            await processPaymentReminders()
            const { processWhatsAppQueue } = await import('../utils/whatsappQueue.js')
            await processWhatsAppQueue()
        } catch (error) {
            logger.error('Scheduler tick failed', { meta: { error } })
        }
    }

    tick()
    setInterval(tick, SCHEDULER_INTERVAL_MS)
    logger.info('Background scheduler started', { meta: { intervalMs: SCHEDULER_INTERVAL_MS } })
}
