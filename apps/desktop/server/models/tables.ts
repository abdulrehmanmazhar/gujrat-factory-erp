import { sql } from 'drizzle-orm'
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const createdAt = () =>
    integer('created_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)

const updatedAt = () =>
    integer('updated_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    password: text('password'),
    role: text('role').notNull().default('User'),
    isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
    avatarPublicId: text('avatar_public_id'),
    avatarUrl: text('avatar_url'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const userRoutes = sqliteTable(
    'user_routes',
    {
        id: text('id').primaryKey(),
        userId: text('user_id').notNull(),
        route: text('route').notNull(),
        createdAt: createdAt()
    },
    (table) => [uniqueIndex('user_routes_user_route_idx').on(table.userId, table.route)]
)

export const customers = sqliteTable('customers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    businessName: text('business_name'),
    address: text('address').notNull(),
    contact: text('contact').notNull().unique(),
    udhar: real('udhar').notNull().default(0),
    route: text('route'),
    createdById: text('created_by_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const products = sqliteTable('products', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    price: real('price').notNull(),
    stockQty: integer('stock_qty').notNull().default(0),
    inStock: integer('in_stock', { mode: 'boolean' }).notNull().default(false),
    purchasePrice: real('purchase_price'),
    discount: real('discount').default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const productStockHistory = sqliteTable('product_stock_history', {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    qty: integer('qty').notNull(),
    totalBill: real('total_bill').notNull(),
    purchasePrice: real('purchase_price').notNull(),
    restockOrderItemId: text('restock_order_item_id'),
    recordedAt: integer('recorded_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    createdAt: createdAt()
})

export const suppliers = sqliteTable('suppliers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    businessName: text('business_name'),
    address: text('address'),
    contact: text('contact').notNull(),
    email: text('email'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const supplierProducts = sqliteTable(
    'supplier_products',
    {
        supplierId: text('supplier_id').notNull(),
        productId: text('product_id').notNull(),
        supplierSku: text('supplier_sku'),
        unitCost: real('unit_cost'),
        isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
        createdAt: createdAt()
    },
    (table) => [primaryKey({ columns: [table.supplierId, table.productId] })]
)

export const restockOrders = sqliteTable('restock_orders', {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id').notNull(),
    referenceNumber: text('reference_number'),
    status: text('status').notNull().default('draft'),
    totalAmount: real('total_amount').notNull().default(0),
    notes: text('notes'),
    createdById: text('created_by_id').notNull(),
    orderedAt: integer('ordered_at', { mode: 'timestamp_ms' }),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const restockOrderItems = sqliteTable('restock_order_items', {
    id: text('id').primaryKey(),
    restockOrderId: text('restock_order_id').notNull(),
    productId: text('product_id').notNull(),
    qtyOrdered: integer('qty_ordered').notNull(),
    qtyReceived: integer('qty_received').notNull().default(0),
    unitCost: real('unit_cost').notNull(),
    lineTotal: real('line_total').notNull(),
    createdAt: createdAt()
})

export const orders = sqliteTable('orders', {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    orderNumber: integer('order_number'),
    price: real('price').default(0),
    payment: real('payment'),
    discount: real('discount').default(0),
    status: text('status'),
    deliveryStatus: integer('delivery_status', { mode: 'boolean' }).default(false),
    deliveryDate: integer('delivery_date', { mode: 'timestamp_ms' }),
    message: text('message'),
    createdById: text('created_by_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const orderItems = sqliteTable('order_items', {
    id: text('id').primaryKey(),
    orderId: text('order_id').notNull(),
    productId: text('product_id').notNull(),
    qty: integer('qty').notNull(),
    unitPrice: real('unit_price').notNull(),
    unitDiscount: real('unit_discount').notNull().default(0),
    createdAt: createdAt()
})

export const customerOrders = sqliteTable(
    'customer_orders',
    {
        id: text('id').primaryKey(),
        customerId: text('customer_id').notNull(),
        orderId: text('order_id').notNull(),
        createdAt: createdAt()
    },
    (table) => [uniqueIndex('customer_orders_customer_order_idx').on(table.customerId, table.orderId)]
)

export const transactions = sqliteTable('transactions', {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    orderId: text('order_id'),
    proofImage: text('proof_image'),
    createdById: text('created_by_id'),
    createdBySystem: integer('created_by_system', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt()
})

export const targets = sqliteTable('targets', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    value: real('value').notNull(),
    productId: text('product_id'),
    startDate: integer('start_date', { mode: 'timestamp_ms' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp_ms' }).notNull(),
    achieved: integer('achieved', { mode: 'boolean' }).notNull().default(false),
    progress: real('progress').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const productSales = sqliteTable('product_sales', {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    customerId: text('customer_id').notNull(),
    stockQtyLeft: integer('stock_qty_left').notNull(),
    sold: integer('sold').notNull(),
    createdAt: createdAt()
})

export type User = typeof users.$inferSelect
export type Customer = typeof customers.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type Target = typeof targets.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type RestockOrder = typeof restockOrders.$inferSelect
export type RestockOrderItem = typeof restockOrderItems.$inferSelect
