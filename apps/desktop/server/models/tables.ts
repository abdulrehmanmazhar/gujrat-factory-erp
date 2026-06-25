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
    contact: text('contact').notNull().unique(),
    password: text('password'),
    role: text('role').notNull().default('User'),
    isVerified: integer('is_verified', { mode: 'boolean' }).notNull().default(false),
    avatarPublicId: text('avatar_public_id'),
    avatarUrl: text('avatar_url'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const customers = sqliteTable('customers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    contact: text('contact').notNull().unique(),
    udhar: real('udhar').notNull().default(0),
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
    amountPaid: real('amount_paid').notNull().default(0),
    amountRefunded: real('amount_refunded').notNull().default(0),
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
    qtyReturned: integer('qty_returned').notNull().default(0),
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
    refunded: real('refunded').notNull().default(0),
    discount: real('discount').default(0),
    status: text('status'),
    orderMode: text('order_mode').notNull().default('delayed'),
    stockDeducted: integer('stock_deducted', { mode: 'boolean' }).notNull().default(false),
    deliveryStatus: integer('delivery_status', { mode: 'boolean' }).default(false),
    deliveryDate: integer('delivery_date', { mode: 'timestamp_ms' }),
    returnedAt: integer('returned_at', { mode: 'timestamp_ms' }),
    lastPaymentReminderAt: integer('last_payment_reminder_at', { mode: 'timestamp_ms' }),
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

export const customerTransactions = sqliteTable('customer_transactions', {
    id: text('id').primaryKey(),
    customerId: text('customer_id').notNull(),
    orderId: text('order_id'),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    proofImage: text('proof_image'),
    createdById: text('created_by_id'),
    createdAt: createdAt()
})

export const supplierTransactions = sqliteTable('supplier_transactions', {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id').notNull(),
    restockOrderId: text('restock_order_id'),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    createdById: text('created_by_id').notNull(),
    createdAt: createdAt()
})

export const labourerTransactions = sqliteTable('labourer_transactions', {
    id: text('id').primaryKey(),
    labourerId: text('labourer_id').notNull(),
    category: text('category').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    createdById: text('created_by_id').notNull(),
    createdAt: createdAt()
})

export const productSales = sqliteTable('product_sales', {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    customerId: text('customer_id').notNull(),
    stockQtyLeft: integer('stock_qty_left').notNull(),
    sold: integer('sold').notNull(),
    createdAt: createdAt()
})

export const whatsappQueue = sqliteTable('whatsapp_queue', {
    id: text('id').primaryKey(),
    contact: text('contact').notNull(),
    kind: text('kind').notNull(),
    payload: text('payload').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const recipes = sqliteTable(
    'recipes',
    {
        id: text('id').primaryKey(),
        outputProductId: text('output_product_id').notNull(),
        notes: text('notes'),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [uniqueIndex('recipes_output_product_idx').on(table.outputProductId)]
)

export const recipeItems = sqliteTable('recipe_items', {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id').notNull(),
    ingredientProductId: text('ingredient_product_id').notNull(),
    qty: real('qty').notNull(),
    createdAt: createdAt()
})

export const labourers = sqliteTable('labourers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    contact: text('contact'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const labourRates = sqliteTable(
    'labour_rates',
    {
        labourerId: text('labourer_id').notNull(),
        productId: text('product_id').notNull(),
        ratePerUnit: real('rate_per_unit').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [primaryKey({ columns: [table.labourerId, table.productId] })]
)

export const labourProductionEntries = sqliteTable('labour_production_entries', {
    id: text('id').primaryKey(),
    labourerId: text('labourer_id').notNull(),
    productId: text('product_id').notNull(),
    qtyProduced: integer('qty_produced').notNull(),
    ratePerUnit: real('rate_per_unit').notNull(),
    totalPay: real('total_pay').notNull(),
    recipeApplied: integer('recipe_applied', { mode: 'boolean' }).notNull().default(false),
    labourerTransactionId: text('labourer_transaction_id'),
    notes: text('notes'),
    createdById: text('created_by_id').notNull(),
    createdAt: createdAt()
})

export const labourProductionConsumption = sqliteTable('labour_production_consumption', {
    id: text('id').primaryKey(),
    entryId: text('entry_id').notNull(),
    productId: text('product_id').notNull(),
    qtyConsumed: real('qty_consumed').notNull(),
    createdAt: createdAt()
})

export type User = typeof users.$inferSelect
export type Customer = typeof customers.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type CustomerTransaction = typeof customerTransactions.$inferSelect
export type SupplierTransaction = typeof supplierTransactions.$inferSelect
export type LabourerTransaction = typeof labourerTransactions.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type RestockOrder = typeof restockOrders.$inferSelect
export type RestockOrderItem = typeof restockOrderItems.$inferSelect
