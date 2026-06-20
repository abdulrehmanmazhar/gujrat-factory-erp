import { relations } from 'drizzle-orm'
import {
    customerOrders,
    customers,
    orderItems,
    orders,
    productSales,
    products,
    productStockHistory,
    restockOrderItems,
    restockOrders,
    supplierProducts,
    suppliers,
    targets,
    transactions,
    userRoutes,
    users
} from './tables.js'

export const usersRelations = relations(users, ({ many }) => ({
    routes: many(userRoutes),
    customers: many(customers),
    orders: many(orders),
    targets: many(targets),
    transactions: many(transactions),
    restockOrders: many(restockOrders)
}))

export const userRoutesRelations = relations(userRoutes, ({ one }) => ({
    user: one(users, { fields: [userRoutes.userId], references: [users.id] })
}))

export const customersRelations = relations(customers, ({ one, many }) => ({
    createdBy: one(users, { fields: [customers.createdById], references: [users.id] }),
    orders: many(customerOrders),
    productSales: many(productSales)
}))

export const customerOrdersRelations = relations(customerOrders, ({ one }) => ({
    customer: one(customers, { fields: [customerOrders.customerId], references: [customers.id] }),
    order: one(orders, { fields: [customerOrders.orderId], references: [orders.id] })
}))

export const productsRelations = relations(products, ({ many }) => ({
    stockHistory: many(productStockHistory),
    orderItems: many(orderItems),
    supplierProducts: many(supplierProducts),
    restockOrderItems: many(restockOrderItems),
    productSales: many(productSales),
    targets: many(targets)
}))

export const productStockHistoryRelations = relations(productStockHistory, ({ one }) => ({
    product: one(products, { fields: [productStockHistory.productId], references: [products.id] })
}))

export const suppliersRelations = relations(suppliers, ({ many }) => ({
    products: many(supplierProducts),
    restockOrders: many(restockOrders)
}))

export const supplierProductsRelations = relations(supplierProducts, ({ one }) => ({
    supplier: one(suppliers, { fields: [supplierProducts.supplierId], references: [suppliers.id] }),
    product: one(products, { fields: [supplierProducts.productId], references: [products.id] })
}))

export const restockOrdersRelations = relations(restockOrders, ({ one, many }) => ({
    supplier: one(suppliers, { fields: [restockOrders.supplierId], references: [suppliers.id] }),
    createdBy: one(users, { fields: [restockOrders.createdById], references: [users.id] }),
    items: many(restockOrderItems)
}))

export const restockOrderItemsRelations = relations(restockOrderItems, ({ one }) => ({
    restockOrder: one(restockOrders, { fields: [restockOrderItems.restockOrderId], references: [restockOrders.id] }),
    product: one(products, { fields: [restockOrderItems.productId], references: [products.id] })
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
    customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
    createdBy: one(users, { fields: [orders.createdById], references: [users.id] }),
    items: many(orderItems),
    transactions: many(transactions),
    customerLinks: many(customerOrders)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
    product: one(products, { fields: [orderItems.productId], references: [products.id] })
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
    order: one(orders, { fields: [transactions.orderId], references: [orders.id] }),
    createdBy: one(users, { fields: [transactions.createdById], references: [users.id] })
}))

export const targetsRelations = relations(targets, ({ one }) => ({
    user: one(users, { fields: [targets.userId], references: [users.id] }),
    product: one(products, { fields: [targets.productId], references: [products.id] })
}))

export const productSalesRelations = relations(productSales, ({ one }) => ({
    product: one(products, { fields: [productSales.productId], references: [products.id] }),
    customer: one(customers, { fields: [productSales.customerId], references: [customers.id] })
}))
