/**
 * Business walkthrough fed to the AI analytics bot via getDatabaseSchema().
 * Keep this in sync when ERP domain tables or money flows change.
 */
export const ERP_WALKTHROUGH = `
# Gujrat Factory ERP — detailed walkthrough for analytics

You are querying a local SQLite ERP used by a factory/business in Pakistan.
Currency is always PKR. Prefer clear business language in explanations.

## How the business works (end-to-end)

### 1) Users & access
- Staff log in as users with roles: User (read-only), admin (write), super_admin (write + deletes).
- Analytics usually ignore passwords/avatars; join users only when you need "who recorded this".

### 2) Inventory (products)
- Products are sold to customers and purchased from suppliers.
- products.price = customer selling price (customer price).
- products.discount = customer discount on that product (default 0).
- products.purchase_price = last known cost/unit (from total cost ÷ qty when stock was added).
- products.stock_qty = on-hand quantity; products.in_stock is true when stock_qty > 0.
- products.unit_id → units.id (pcs, kg, liter, etc.).
- categories is a nested tree (parent_id self-reference, unlimited depth).
- product_categories links products ↔ categories (many-to-many).
- products.category is a denormalized display/search label synced from assigned category paths.
- product_stock_history audits inbound stock events (qty + purchase_price). Prefer products.stock_qty for current inventory.
- product_sales logs stock movement tied to customers when order stock is adjusted (sold can be negative on restores).

### 3) Customers & udhar (credit)
- customers.udhar = outstanding credit the customer still owes the factory.
- When a customer pays for an order, udhar decreases; when money is refunded, udhar increases.
- Outstanding on an order ≈ max(0, (orders.price - orders.discount) - orders.payment).
- Refundable on an order ≈ max(0, orders.payment - orders.refunded).
- Standalone Khata customer entries (customer_transactions with order_id IS NULL) also adjust udhar:
  In (udhar_payment) decreases udhar; Out (refund) increases udhar.

### 4) Sales orders (customer side)
Flow:
1. Create order (POS immediate or delayed) with order_items.
2. Stock may be deducted (stock_deducted=1) when finalized/delivered depending on mode.
3. Payments can be recorded in installments (orders.payment increases; customer_transactions type 'sale').
4. Refunds can be recorded in installments (orders.refunded increases; type 'refund').
5. Returns restore stock and may refund cash; status becomes 'returned'.
6. Cancelled orders use status 'cancelled'.

Key order fields:
- order_mode: 'pos' | 'delayed'
- status: commonly 'saved' | 'cancelled' | 'returned' (and related saved/finalized states used by the app)
- delivery_status: 1 delivered, 0 not
- price: order subtotal before order-level discount handling in UI; payable ≈ price - discount
- payment: total paid so far
- refunded: total refunded so far
- delivery_date, returned_at, created_at: Unix ms timestamps

order_items:
- qty, unit_price, unit_discount per product line
- Join products for names/categories/units

customer_transactions (money ledger for customers):
- type: 'sale' (money received / payment against sale), 'refund', 'udhar_payment'
- amount always positive; meaning depends on type
- payment_mode: 'cash' | 'online'
- proof_image optional receipt URL/path
- Prefer this table for cashflow charts of customer money in/out
- For revenue from completed sales, filter type='sale' and optionally join orders (exclude cancelled/returned if asking for "valid sales")

### 5) Suppliers & restock (purchase side)
- suppliers.payable = standalone Khata balance the factory still owes the supplier (not restock-order outstanding).
Flow:
1. Link suppliers to products via supplier_products (optional sku/unit_cost).
2. Create restock_orders (status draft → ordered → received, or cancelled).
3. restock_order_items track qty_ordered, qty_received, qty_returned, unit_cost, line_total.
4. Receiving stock increases product inventory.
5. Pay supplier: supplier_transactions type 'payment' increases restock_orders.amount_paid.
6. Return stock to supplier may reduce order total; cash back from supplier uses type 'refund' and increases amount_refunded.
7. Standalone Khata supplier entries (supplier_transactions with restock_order_id IS NULL) adjust suppliers.payable:
   Out (payment) decreases payable; In (refund) increases payable.

Outstanding to supplier on a restock order ≈
  max(0, total_amount - amount_paid) after accounting for refunds/returns as stored on the order.
Restock outstanding stays separate from suppliers.payable.

### 6) Labour & production
- labourers are workers; labour_rates set rate_per_unit per product.
- Recording production creates labour_production_entries (qty_produced, rate_per_unit, total_pay).
- If a recipe exists for the output product, ingredients are consumed into labour_production_consumption and stock decreases.
- labourer_transactions: category in ('production','advance','bonus','expense','other') — money paid to workers / labour expenses.
- Production pay may also create a labourer_transaction linked via labourer_transaction_id.

### 7) Recipes (BOM)
- recipes.output_product_id = finished good.
- recipe_items.ingredient_product_id + qty = materials needed per 1 unit produced.
- Used when production is recorded with recipe applied.

### 8) Miscellaneous factory expenditure
- miscellaneous_expenditures: overheads not tied to a customer/supplier order.
- amount, payment_mode cash|online, note (required), optional proof_image.
- Include these in "total expenses" / overhead analytics.

### 8b) Khata (standalone party ledger)
- Factory cashflow In = money received into the factory; Out = money paid from the factory.
- Customer/supplier Khata rows keep order_id / restock_order_id null.
- Customer WhatsApp text slip may be queued after customer Khata create (no PDF).

### 9) WhatsApp & AI meta tables (usually ignore for business KPIs)
- whatsapp_queue: outbound message jobs — not financial.
- user_gemini_api_keys, ai_chat_sessions, ai_chat_messages: AI feature internals — do not use for sales/expense analytics.
- users: staff accounts — only join for "recorded by" names.
- __drizzle_migrations / sqlite internals: never query.

## Money definitions (use these consistently)

Revenue / sales inflow:
- SUM(customer_transactions.amount) WHERE type = 'sale'
- Or order-based: SUM(orders.payment) for non-cancelled orders (understand payment is cumulative paid, not "today's payment" unless filtered by transaction date)

Customer refunds outflow:
- SUM(customer_transactions.amount) WHERE type = 'refund'

Supplier payments outflow:
- SUM(supplier_transactions.amount) WHERE type = 'payment'

Supplier refunds inflow:
- SUM(supplier_transactions.amount) WHERE type = 'refund'

Labour cost:
- SUM(labourer_transactions.amount) and/or SUM(labour_production_entries.total_pay)

Misc overhead:
- SUM(miscellaneous_expenditures.amount)

Inventory value (approx):
- SUM(products.stock_qty * COALESCE(products.purchase_price, 0))
- Selling value on hand: SUM(products.stock_qty * products.price)

Udhar / receivables:
- SUM(customers.udhar)

## Table relationship map (join keys)

users.id ← created_by_id on many tables
customers.id ← orders.customer_id, customer_transactions.customer_id, product_sales.customer_id
units.id ← products.unit_id
categories.id ← categories.parent_id, product_categories.category_id
products.id ← order_items.product_id, restock_order_items.product_id, recipes.output_product_id,
              recipe_items.ingredient_product_id, labour_rates.product_id, labour_production_entries.product_id,
              labour_production_consumption.product_id, product_stock_history.product_id, product_sales.product_id,
              supplier_products.product_id, product_categories.product_id
orders.id ← order_items.order_id, customer_transactions.order_id
suppliers.id ← restock_orders.supplier_id, supplier_transactions.supplier_id, supplier_products.supplier_id
restock_orders.id ← restock_order_items.restock_order_id, supplier_transactions.restock_order_id
labourers.id ← labour_rates.labourer_id, labourer_transactions.labourer_id, labour_production_entries.labourer_id
labour_production_entries.id ← labour_production_consumption.entry_id
recipes.id ← recipe_items.recipe_id

## Important enums / values

orders.order_mode: pos | delayed
orders.status: saved | cancelled | returned (filter carefully)
customer_transactions.type: sale | refund | udhar_payment
customer_transactions.payment_mode / supplier_transactions.payment_mode / miscellaneous_expenditures.payment_mode: cash | online
restock_orders.status: draft | ordered | received | cancelled
labourer_transactions.category: production | advance | bonus | expense | other
SQLite booleans are integers 0/1 (in_stock, delivery_status, stock_deducted, is_active, recipe_applied)

## Timestamp rules (critical)

Most date/time columns are Unix milliseconds integers (created_at, updated_at, delivery_date, ordered_at, received_at, returned_at, recorded_at, ...).
Convert with:
  datetime(column/1000, 'unixepoch')
  date(column/1000, 'unixepoch')
Group by month example:
  strftime('%Y-%m', datetime(created_at/1000, 'unixepoch'))

## Query tips for good charts

1. Call getDatabaseSchema first if unsure of columns.
2. Always filter cancelled/returned orders when the user asks for "sales performance" unless they want all statuses.
3. Prefer ledger tables (customer_transactions / supplier_transactions / miscellaneous_expenditures / labourer_transactions) for cash movement over time.
4. Prefer orders + order_items for product mix / quantity sold.
5. Limit huge dumps; aggregate with GROUP BY for charts.
6. Alias columns to stable chart keys (month, total, name, qty).
7. Never invent rows — if empty, explain and return charts: [].

## Example analytics intents → tables

- Monthly sales revenue → customer_transactions (type='sale') by month
- Top selling products → order_items JOIN products JOIN orders (exclude cancelled)
- Customer outstanding credit → customers.udhar
- Inventory low stock → products WHERE stock_qty low / in_stock=0
- Supplier restock outstanding → restock_orders outstanding
- Supplier Khata payable → suppliers.payable (standalone ledger only)
- Labour cost this month → labourer_transactions / labour_production_entries
- Overhead expenses → miscellaneous_expenditures
- Cash vs online mix → payment_mode on the relevant ledger table
`.trim()
