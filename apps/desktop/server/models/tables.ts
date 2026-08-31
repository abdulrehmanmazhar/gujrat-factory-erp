import { sql } from 'drizzle-orm'
import { type AnySQLiteColumn, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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

export const units = sqliteTable('units', {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const categories = sqliteTable(
    'categories',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        parentId: text('parent_id').references((): AnySQLiteColumn => categories.id, { onDelete: 'restrict' }),
        sortOrder: integer('sort_order').notNull().default(0),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [uniqueIndex('categories_parent_name_idx').on(table.parentId, table.name)]
)

export const customers = sqliteTable('customers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    contact: text('contact').notNull().unique(),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
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
    unitId: text('unit_id')
        .notNull()
        .default('unit-pcs')
        .references(() => units.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const productCategories = sqliteTable(
    'product_categories',
    {
        productId: text('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'cascade' }),
        categoryId: text('category_id')
            .notNull()
            .references(() => categories.id, { onDelete: 'cascade' }),
        createdAt: createdAt()
    },
    (table) => [primaryKey({ columns: [table.productId, table.categoryId] })]
)

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
        supplierId: text('supplier_id')
            .notNull()
            .references(() => suppliers.id, { onDelete: 'cascade' }),
        productId: text('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'cascade' }),
        supplierSku: text('supplier_sku'),
        unitCost: real('unit_cost'),
        isPreferred: integer('is_preferred', { mode: 'boolean' }).notNull().default(false),
        createdAt: createdAt()
    },
    (table) => [primaryKey({ columns: [table.supplierId, table.productId] })]
)

export const restockOrders = sqliteTable('restock_orders', {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id')
        .notNull()
        .references(() => suppliers.id, { onDelete: 'restrict' }),
    referenceNumber: text('reference_number'),
    status: text('status').notNull().default('draft'),
    totalAmount: real('total_amount').notNull().default(0),
    amountPaid: real('amount_paid').notNull().default(0),
    amountRefunded: real('amount_refunded').notNull().default(0),
    notes: text('notes'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    orderedAt: integer('ordered_at', { mode: 'timestamp_ms' }),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const restockOrderItems = sqliteTable('restock_order_items', {
    id: text('id').primaryKey(),
    restockOrderId: text('restock_order_id')
        .notNull()
        .references(() => restockOrders.id, { onDelete: 'cascade' }),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    qtyOrdered: integer('qty_ordered').notNull(),
    qtyReceived: integer('qty_received').notNull().default(0),
    qtyReturned: integer('qty_returned').notNull().default(0),
    unitCost: real('unit_cost').notNull(),
    lineTotal: real('line_total').notNull(),
    createdAt: createdAt()
})

export const productStockHistory = sqliteTable('product_stock_history', {
    id: text('id').primaryKey(),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'cascade' }),
    qty: integer('qty').notNull(),
    purchasePrice: real('purchase_price').notNull(),
    restockOrderItemId: text('restock_order_item_id').references(() => restockOrderItems.id, { onDelete: 'set null' }),
    recordedAt: integer('recorded_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    createdAt: createdAt()
})

export const orders = sqliteTable('orders', {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'restrict' }),
    orderNumber: integer('order_number'),
    price: real('price').default(0),
    payment: real('payment'),
    refunded: real('refunded').notNull().default(0),
    discount: real('discount').default(0),
    charges: real('charges').notNull().default(0),
    additionalChargesJson: text('additional_charges_json').notNull().default('[]'),
    additionalDiscountsJson: text('additional_discounts_json').notNull().default('[]'),
    invoiceBreakdown: integer('invoice_breakdown', { mode: 'boolean' }).notNull().default(true),
    status: text('status'),
    orderMode: text('order_mode').notNull().default('delayed'),
    stockDeducted: integer('stock_deducted', { mode: 'boolean' }).notNull().default(false),
    deliveryStatus: integer('delivery_status', { mode: 'boolean' }).default(false),
    deliveryDate: integer('delivery_date', { mode: 'timestamp_ms' }),
    returnedAt: integer('returned_at', { mode: 'timestamp_ms' }),
    lastPaymentReminderAt: integer('last_payment_reminder_at', { mode: 'timestamp_ms' }),
    message: text('message'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const orderItems = sqliteTable('order_items', {
    id: text('id').primaryKey(),
    orderId: text('order_id')
        .notNull()
        .references(() => orders.id, { onDelete: 'cascade' }),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    qty: integer('qty').notNull(),
    unitPrice: real('unit_price').notNull(),
    unitDiscount: real('unit_discount').notNull().default(0),
    createdAt: createdAt()
})

export const customerTransactions = sqliteTable('customer_transactions', {
    id: text('id').primaryKey(),
    customerId: text('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'restrict' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    paymentMode: text('payment_mode').notNull().default('cash'),
    proofImage: text('proof_image'),
    proofImagePublicId: text('proof_image_public_id'),
    createdById: text('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt()
})

export const supplierTransactions = sqliteTable('supplier_transactions', {
    id: text('id').primaryKey(),
    supplierId: text('supplier_id')
        .notNull()
        .references(() => suppliers.id, { onDelete: 'restrict' }),
    restockOrderId: text('restock_order_id').references(() => restockOrders.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    paymentMode: text('payment_mode').notNull().default('cash'),
    proofImage: text('proof_image'),
    proofImagePublicId: text('proof_image_public_id'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
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

export const labourerTransactions = sqliteTable('labourer_transactions', {
    id: text('id').primaryKey(),
    labourerId: text('labourer_id')
        .notNull()
        .references(() => labourers.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    amount: real('amount').notNull(),
    description: text('description').notNull(),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
})

export const labourRates = sqliteTable(
    'labour_rates',
    {
        labourerId: text('labourer_id')
            .notNull()
            .references(() => labourers.id, { onDelete: 'cascade' }),
        productId: text('product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'cascade' }),
        ratePerUnit: real('rate_per_unit').notNull(),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [primaryKey({ columns: [table.labourerId, table.productId] })]
)

export const labourProductionEntries = sqliteTable('labour_production_entries', {
    id: text('id').primaryKey(),
    labourerId: text('labourer_id')
        .notNull()
        .references(() => labourers.id, { onDelete: 'restrict' }),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    qtyProduced: integer('qty_produced').notNull(),
    ratePerUnit: real('rate_per_unit').notNull(),
    totalPay: real('total_pay').notNull(),
    recipeApplied: integer('recipe_applied', { mode: 'boolean' }).notNull().default(false),
    labourerTransactionId: text('labourer_transaction_id').references(() => labourerTransactions.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
})

export const labourProductionConsumption = sqliteTable('labour_production_consumption', {
    id: text('id').primaryKey(),
    entryId: text('entry_id')
        .notNull()
        .references(() => labourProductionEntries.id, { onDelete: 'cascade' }),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    qtyConsumed: real('qty_consumed').notNull(),
    createdAt: createdAt()
})

export const productSales = sqliteTable('product_sales', {
    id: text('id').primaryKey(),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
        .notNull()
        .references(() => customers.id, { onDelete: 'restrict' }),
    stockQtyLeft: integer('stock_qty_left').notNull(),
    sold: integer('sold').notNull(),
    createdAt: createdAt()
})

/** Depletable inventory lots used for FIFO costing. */
export const inventoryBatches = sqliteTable('inventory_batches', {
    id: text('id').primaryKey(),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'cascade' }),
    /** supplier | labour | opening | conversion | manual */
    sourceType: text('source_type').notNull(),
    sourceRefId: text('source_ref_id'),
    restockOrderItemId: text('restock_order_item_id').references(() => restockOrderItems.id, { onDelete: 'set null' }),
    labourProductionEntryId: text('labour_production_entry_id'),
    conversionId: text('conversion_id'),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    labourerId: text('labourer_id').references(() => labourers.id, { onDelete: 'set null' }),
    originalQty: integer('original_qty').notNull(),
    remainingQty: integer('remaining_qty').notNull(),
    unitCost: real('unit_cost').notNull().default(0),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' })
        .notNull()
        .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    notes: text('notes'),
    createdAt: createdAt()
})

/** Immutable FIFO issue/restore lines against inventory batches. */
export const inventoryBatchAllocations = sqliteTable('inventory_batch_allocations', {
    id: text('id').primaryKey(),
    batchId: text('batch_id')
        .notNull()
        .references(() => inventoryBatches.id, { onDelete: 'cascade' }),
    productId: text('product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'cascade' }),
    qty: integer('qty').notNull(),
    unitCost: real('unit_cost').notNull(),
    /** sale | production | conversion | return | restore | adjustment */
    reason: text('reason').notNull(),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    productSaleId: text('product_sale_id').references(() => productSales.id, { onDelete: 'set null' }),
    labourProductionEntryId: text('labour_production_entry_id'),
    conversionId: text('conversion_id'),
    restockOrderItemId: text('restock_order_item_id').references(() => restockOrderItems.id, { onDelete: 'set null' }),
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
    customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
    transactionId: text('transaction_id').references(() => customerTransactions.id, { onDelete: 'set null' }),
    /** invoice | receipt | text | other */
    docType: text('doc_type'),
    orderNumber: integer('order_number'),
    displayName: text('display_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const recipes = sqliteTable(
    'recipes',
    {
        id: text('id').primaryKey(),
        outputProductId: text('output_product_id')
            .notNull()
            .references(() => products.id, { onDelete: 'cascade' }),
        notes: text('notes'),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [uniqueIndex('recipes_output_product_idx').on(table.outputProductId)]
)

export const recipeItems = sqliteTable('recipe_items', {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
        .notNull()
        .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientProductId: text('ingredient_product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    qty: real('qty').notNull(),
    createdAt: createdAt()
})

export const userGeminiApiKeys = sqliteTable('user_gemini_api_keys', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: 'cascade' }),
    apiKey: text('api_key').notNull(),
    model: text('model').notNull().default('gemini-2.5-flash'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

/** Per-user AI provider preference (Gemini cloud key vs local Ollama). */
export const userAiProviderSettings = sqliteTable('user_ai_provider_settings', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .unique()
        .references(() => users.id, { onDelete: 'cascade' }),
    /** gemini | ollama */
    provider: text('provider').notNull().default('gemini'),
    ollamaPort: integer('ollama_port').notNull().default(11434),
    /** Full Ollama API base URL, e.g. http://127.0.0.1:11434 or https://ollama.example.com */
    ollamaBaseUrl: text('ollama_base_url').notNull().default('http://127.0.0.1:11434'),
    ollamaModel: text('ollama_model'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const aiChatSessions = sqliteTable('ai_chat_sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

export const aiChatMessages = sqliteTable('ai_chat_messages', {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
        .notNull()
        .references(() => aiChatSessions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    responseJson: text('response_json'),
    createdAt: createdAt()
})

export const miscExpenditureCategories = sqliteTable(
    'misc_expenditure_categories',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        parentId: text('parent_id').references((): AnySQLiteColumn => miscExpenditureCategories.id, { onDelete: 'restrict' }),
        sortOrder: integer('sort_order').notNull().default(0),
        createdAt: createdAt(),
        updatedAt: updatedAt()
    },
    (table) => [uniqueIndex('misc_expenditure_categories_parent_name_idx').on(table.parentId, table.name)]
)

export const miscellaneousExpenditures = sqliteTable('miscellaneous_expenditures', {
    id: text('id').primaryKey(),
    amount: real('amount').notNull(),
    paymentMode: text('payment_mode').notNull().default('cash'),
    note: text('note').notNull(),
    categoryId: text('category_id').references(() => miscExpenditureCategories.id, { onDelete: 'set null' }),
    proofImage: text('proof_image'),
    proofImagePublicId: text('proof_image_public_id'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
})

/** One-off product conversions: input product → output product with a qty relation. */
export const productConversions = sqliteTable('product_conversions', {
    id: text('id').primaryKey(),
    inputProductId: text('input_product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    outputProductId: text('output_product_id')
        .notNull()
        .references(() => products.id, { onDelete: 'restrict' }),
    /** Relation: inputRatio units of input = outputRatio units of output */
    inputRatio: real('input_ratio').notNull(),
    outputRatio: real('output_ratio').notNull(),
    /** Actual stock moved */
    inputQty: integer('input_qty').notNull(),
    outputQty: integer('output_qty').notNull(),
    notes: text('notes'),
    createdById: text('created_by_id')
        .notNull()
        .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: createdAt()
})

export type User = typeof users.$inferSelect
export type Customer = typeof customers.$inferSelect
export type Category = typeof categories.$inferSelect
export type Product = typeof products.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type CustomerTransaction = typeof customerTransactions.$inferSelect
export type SupplierTransaction = typeof supplierTransactions.$inferSelect
export type LabourerTransaction = typeof labourerTransactions.$inferSelect
export type Supplier = typeof suppliers.$inferSelect
export type RestockOrder = typeof restockOrders.$inferSelect
export type RestockOrderItem = typeof restockOrderItems.$inferSelect
export type MiscExpenditureCategory = typeof miscExpenditureCategories.$inferSelect
export type ProductConversion = typeof productConversions.$inferSelect
export type InventoryBatch = typeof inventoryBatches.$inferSelect
export type InventoryBatchAllocation = typeof inventoryBatchAllocations.$inferSelect
