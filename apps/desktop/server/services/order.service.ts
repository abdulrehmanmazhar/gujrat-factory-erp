// @ts-nocheck

import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import schedule from 'node-schedule'
import { db } from '../utils/db.js'
import { customerOrders, customers, orderItems, orders, products, targets, transactions, users } from '../models/tables.js'
import { AppError } from '../utils/errors.js'
import { createId, mapOrderWithCart, withLegacyId } from '../utils/mappers.js'
import { logger } from '../config/logger.js'
import { adjustProductStock, findProductsByIds } from './product.service.js'

type CartInput = { productId: string; qty: number }[]

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

export async function targetUpdation(userId: string) {
    try {
        const activeTargets = await db
            .select()
            .from(targets)
            .where(and(eq(targets.userId, userId), gte(targets.endDate, new Date())))

        await Promise.all(
            activeTargets.map(async (target) => {
                let progress = 0
                const dateFilter = and(gte(orders.createdAt, target.startDate), lte(orders.createdAt, target.endDate))

                if (target.type === 'orders') {
                    const userOrders = target.productId
                        ? await db
                              .select({ orderId: orders.id })
                              .from(orders)
                              .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
                              .where(and(eq(orders.createdById, userId), dateFilter, eq(orderItems.productId, target.productId)))
                        : await db
                              .select()
                              .from(orders)
                              .where(and(eq(orders.createdById, userId), dateFilter))
                    progress = new Set(userOrders.map((o) => ('orderId' in o ? o.orderId : o.id))).size
                } else if (target.type === 'quantity') {
                    const rows = await db
                        .select({ qty: orderItems.qty })
                        .from(orders)
                        .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
                        .where(
                            and(eq(orders.createdById, userId), dateFilter, target.productId ? eq(orderItems.productId, target.productId) : sql`1=1`)
                        )
                    progress = rows.reduce((acc, row) => acc + row.qty, 0)
                } else if (target.type === 'sales') {
                    const userOrders = await db
                        .select()
                        .from(orders)
                        .where(and(eq(orders.createdById, userId), dateFilter))
                    progress = userOrders.reduce((acc, order) => acc + (order.payment ?? 0), 0)
                }

                await db
                    .update(targets)
                    .set({ progress, achieved: progress >= target.value, updatedAt: new Date() })
                    .where(eq(targets.id, target.id))
            })
        )
    } catch (error) {
        logger.error('Could not update the target', { meta: { error } })
    }
}

async function processCart(customerId: string, createdById: string, cart: CartInput) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 400)

    const productIds = cart.map((item) => item.productId)
    const productList = await findProductsByIds(productIds)
    if (productList.length !== productIds.length) throw new AppError('Some products not found', 400)

    const productMap = new Map(productList.map((p) => [p.id, p]))

    for (const { productId, qty } of cart) {
        const product = productMap.get(productId)
        if (!product) continue
        await adjustProductStock(customerId, productId, qty, 'minus')
    }

    let order = await findDraftOrder(customerId)
    if (!order) {
        const [created] = await db.insert(orders).values({ id: createId(), customerId, createdById }).returning()
        order = created
    }

    await upsertCartItems(order.id, cart, productMap)
    await targetUpdation(createdById)

    const items = await getOrderItemsWithProducts(order.id)
    return mapOrderWithCart(order, items)
}

export async function createCart(customerId: string, createdById: string, cart: CartInput) {
    return processCart(customerId, createdById, cart)
}

function calculateOrderTotals(items: Awaited<ReturnType<typeof getOrderItemsWithProducts>>, additionalDiscount: number) {
    const price = items.reduce((acc, item) => acc + item.unitPrice * item.qty, 0)
    const discount = items.reduce((acc, item) => acc + item.unitDiscount * item.qty, 0) + additionalDiscount
    return { price, discount }
}

async function getNextOrderNumber() {
    const [last] = await db.select({ orderNumber: orders.orderNumber }).from(orders).orderBy(desc(orders.orderNumber)).limit(1)
    return last?.orderNumber ? last.orderNumber + 1 : 1
}

async function finalizeOrder(orderId: string, customerId: string, deliveryDate: string, message: string, additionalDiscount: number) {
    const items = await getOrderItemsWithProducts(orderId)
    const { price, discount } = calculateOrderTotals(items, additionalDiscount)
    const delivery = new Date(deliveryDate)
    delivery.setUTCHours(0, 0, 0, 0)

    const [order] = await db
        .update(orders)
        .set({
            orderNumber: await getNextOrderNumber(),
            deliveryDate: delivery,
            message,
            status: 'saved',
            deliveryStatus: false,
            price,
            discount,
            updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning()

    await db.insert(customerOrders).values({ id: createId(), customerId, orderId }).onConflictDoNothing()

    const { sendOrderReceiptWhatsApp } = await import('./invoice.service.js')
    await sendOrderReceiptWhatsApp(orderId)

    return order
}

export async function createOrder(
    customerId: string,
    createdById: string,
    cart: CartInput,
    deliveryDate: string,
    message = '',
    additionalDiscount = 0
) {
    if (!deliveryDate) throw new AppError('Missing required fields', 400)
    const order = await processCart(customerId, createdById, cart)
    await finalizeOrder(order.id, customerId, deliveryDate, message, additionalDiscount)
    return { message: 'Order saved successfully' }
}

export async function deleteCartItem(orderId: string, index: number) {
    const items = await getOrderItemsWithProducts(orderId)
    const cartItem = items[index]
    if (!cartItem) throw new AppError('Cart item not found', 400)

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 400)

    await adjustProductStock(order.customerId, cartItem.productId, cartItem.qty, 'add')
    await db.delete(orderItems).where(eq(orderItems.id, cartItem.id))
}

export async function addOrder(orderId: string, deliveryDate: string, message = '', additionalDiscount = 0) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 400)
    if (!deliveryDate) throw new AppError('Missing required fields', 400)

    await finalizeOrder(orderId, order.customerId, deliveryDate, message, additionalDiscount)
    return { message: 'Order saved successfully' }
}

export async function deleteOrder(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 400)

    const items = await getOrderItemsWithProducts(orderId)
    for (const item of items) {
        await adjustProductStock(order.customerId, item.productId, item.qty, 'add')
    }

    await db.delete(customerOrders).where(eq(customerOrders.orderId, orderId))
    await db.delete(orders).where(eq(orders.id, orderId))
}

export async function getOrder(orderId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    const items = await getOrderItemsWithProducts(orderId)
    return mapOrderWithCart(order, items)
}

export async function listOrders() {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt))
    if (!allOrders.length) throw new AppError('No orders found', 404)

    return Promise.all(
        allOrders.map(async (order) => {
            const [userDetails] = await db
                .select({ id: users.id, name: users.name, email: users.email })
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
                userDetails: userDetails ? withLegacyId(userDetails) : { name: 'Unknown User', email: 'N/A' },
                customerDetails: customerDetails ? withLegacyId(customerDetails) : { name: 'Unknown Customer', contact: 'N/A' }
            }
        })
    )
}

export async function addOrderPayment(orderId: string, payment: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.payment !== null && order.payment !== undefined) throw new AppError('Payment has already been made and cannot be changed', 400)

    const orderPrice = order.price ?? 0
    const discount = order.discount ?? 0
    const remainingAmount = orderPrice - discount - (order.payment ?? 0)
    if (payment > remainingAmount) throw new AppError('Cannot pay more than remaining amount', 400)

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const newUdhar = Math.max((customer.udhar || 0) + remainingAmount - payment, 0)

    const [updatedOrder] = await db
        .update(orders)
        .set({ payment, deliveryStatus: true, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning()

    if (payment > 0) {
        await db.insert(transactions).values({
            id: createId(),
            type: 'sale',
            amount: payment,
            description: 'Sales from order',
            createdById: userId
        })
    }

    await db.update(customers).set({ udhar: newUdhar, updatedAt: new Date() }).where(eq(customers.id, customer.id))
    return withLegacyId(updatedOrder)
}

export async function returnOrderUdhar(orderId: string, payment: number, userId: string) {
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    if (!order) throw new AppError('Order not found', 404)
    if (order.payment === null || order.payment === undefined) throw new AppError("Cannot modify this order's payment", 400)

    const totalPayable = (order.price ?? 0) - (order.discount ?? 0)
    if ((order.payment ?? 0) >= totalPayable) throw new AppError('This order is already fully paid', 400)

    const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1)
    if (!customer) throw new AppError('Customer not found', 404)

    const remainingAmount = totalPayable - (order.payment ?? 0)
    if (payment > remainingAmount) throw new AppError('Cannot pay more than the remaining amount', 400)
    if (payment > customer.udhar) throw new AppError("Cannot pay more than customer's udhar amount", 400)
    if (payment === 0 && order.payment === 0) throw new AppError('Payment has already been recorded as zero', 400)

    await db.insert(transactions).values({
        id: createId(),
        type: 'sale',
        amount: payment,
        description: `${customer.name} (${customer.address}) paid from their udhar: ${customer.udhar}`,
        createdById: userId
    })

    await db
        .update(customers)
        .set({ udhar: Math.max(customer.udhar - payment, 0), updatedAt: new Date() })
        .where(eq(customers.id, customer.id))

    const [updated] = await db
        .update(orders)
        .set({ payment: (order.payment ?? 0) + payment, updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .returning()

    return withLegacyId(updated)
}

export function runScheduler() {
    schedule.scheduleJob('updateOrderPayments', '30 23 * * *', async () => {
        try {
            const today = new Date()
            today.setUTCHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setUTCDate(today.getUTCDate() + 1)

            const dueOrders = await db
                .select()
                .from(orders)
                .where(and(gte(orders.deliveryDate, today), lte(orders.deliveryDate, tomorrow), isNull(orders.payment)))

            for (const order of dueOrders) {
                await db
                    .update(orders)
                    .set({ payment: order.price ?? 0, deliveryStatus: true, updatedAt: new Date() })
                    .where(eq(orders.id, order.id))

                await db.insert(transactions).values({
                    id: createId(),
                    type: 'sale',
                    description: `Sale against order number ${order.orderNumber} as sale`,
                    amount: order.price ?? 0,
                    orderId: order.id,
                    createdBySystem: true
                })
            }
        } catch (error) {
            logger.error('Failed nightly order payment check', { meta: { error } })
        }
    })
}
