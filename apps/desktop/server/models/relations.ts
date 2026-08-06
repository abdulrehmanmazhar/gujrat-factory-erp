import { relations } from 'drizzle-orm'
import {
    categories,
    customerTransactions,
    customers,
    labourerTransactions,
    labourers,
    orderItems,
    orders,
    productCategories,
    productSales,
    products,
    productStockHistory,
    restockOrderItems,
    restockOrders,
    supplierProducts,
    supplierTransactions,
    suppliers,
    users
} from './tables.js'

export const usersRelations = relations(users, ({ many }) => ({
    customers: many(customers),
    orders: many(orders),
    customerTransactions: many(customerTransactions),
    supplierTransactions: many(supplierTransactions),
    labourerTransactions: many(labourerTransactions),
    restockOrders: many(restockOrders)
}))

export const customersRelations = relations(customers, ({ one, many }) => ({
    createdBy: one(users, { fields: [customers.createdById], references: [users.id] }),
    orders: many(orders),
    productSales: many(productSales),
    transactions: many(customerTransactions)
}))

export const customerTransactionsRelations = relations(customerTransactions, ({ one }) => ({
    customer: one(customers, { fields: [customerTransactions.customerId], references: [customers.id] }),
    order: one(orders, { fields: [customerTransactions.orderId], references: [orders.id] }),
    createdBy: one(users, { fields: [customerTransactions.createdById], references: [users.id] })
}))

export const suppliersRelations = relations(suppliers, ({ many }) => ({
    products: many(supplierProducts),
    restockOrders: many(restockOrders),
    transactions: many(supplierTransactions)
}))

export const supplierTransactionsRelations = relations(supplierTransactions, ({ one }) => ({
    supplier: one(suppliers, { fields: [supplierTransactions.supplierId], references: [suppliers.id] }),
    restockOrder: one(restockOrders, { fields: [supplierTransactions.restockOrderId], references: [restockOrders.id] }),
    createdBy: one(users, { fields: [supplierTransactions.createdById], references: [users.id] })
}))

export const labourersRelations = relations(labourers, ({ many }) => ({
    transactions: many(labourerTransactions)
}))

export const labourerTransactionsRelations = relations(labourerTransactions, ({ one }) => ({
    labourer: one(labourers, { fields: [labourerTransactions.labourerId], references: [labourers.id] }),
    createdBy: one(users, { fields: [labourerTransactions.createdById], references: [users.id] })
}))

export const categoriesRelations = relations(categories, ({ one, many }) => ({
    parent: one(categories, {
        fields: [categories.parentId],
        references: [categories.id],
        relationName: 'category_tree'
    }),
    children: many(categories, { relationName: 'category_tree' }),
    productLinks: many(productCategories)
}))

export const productsRelations = relations(products, ({ many }) => ({
    stockHistory: many(productStockHistory),
    orderItems: many(orderItems),
    supplierProducts: many(supplierProducts),
    restockOrderItems: many(restockOrderItems),
    productSales: many(productSales),
    categoryLinks: many(productCategories)
}))

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
    product: one(products, { fields: [productCategories.productId], references: [products.id] }),
    category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] })
}))

export const productStockHistoryRelations = relations(productStockHistory, ({ one }) => ({
    product: one(products, { fields: [productStockHistory.productId], references: [products.id] })
}))

export const supplierProductsRelations = relations(supplierProducts, ({ one }) => ({
    supplier: one(suppliers, { fields: [supplierProducts.supplierId], references: [suppliers.id] }),
    product: one(products, { fields: [supplierProducts.productId], references: [products.id] })
}))

export const restockOrdersRelations = relations(restockOrders, ({ one, many }) => ({
    supplier: one(suppliers, { fields: [restockOrders.supplierId], references: [suppliers.id] }),
    createdBy: one(users, { fields: [restockOrders.createdById], references: [users.id] }),
    items: many(restockOrderItems),
    transactions: many(supplierTransactions)
}))

export const restockOrderItemsRelations = relations(restockOrderItems, ({ one }) => ({
    restockOrder: one(restockOrders, { fields: [restockOrderItems.restockOrderId], references: [restockOrders.id] }),
    product: one(products, { fields: [restockOrderItems.productId], references: [products.id] })
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
    customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
    createdBy: one(users, { fields: [orders.createdById], references: [users.id] }),
    items: many(orderItems),
    transactions: many(customerTransactions)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
    product: one(products, { fields: [orderItems.productId], references: [products.id] })
}))

export const productSalesRelations = relations(productSales, ({ one }) => ({
    product: one(products, { fields: [productSales.productId], references: [products.id] }),
    customer: one(customers, { fields: [productSales.customerId], references: [customers.id] })
}))
