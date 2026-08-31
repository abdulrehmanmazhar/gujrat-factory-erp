-- Add foreign keys with cascade/set-null/restrict across ERP tables.
-- SQLite requires table rebuilds; keep FKs off for the whole migration.
PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- Orphan cleanup so RESTRICT / SET NULL inserts succeed
UPDATE customer_transactions SET order_id = NULL WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM orders);--> statement-breakpoint
UPDATE customer_transactions SET created_by_id = NULL WHERE created_by_id IS NOT NULL AND created_by_id NOT IN (SELECT id FROM users);--> statement-breakpoint
UPDATE supplier_transactions SET restock_order_id = NULL WHERE restock_order_id IS NOT NULL AND restock_order_id NOT IN (SELECT id FROM restock_orders);--> statement-breakpoint
UPDATE product_stock_history SET restock_order_item_id = NULL WHERE restock_order_item_id IS NOT NULL AND restock_order_item_id NOT IN (SELECT id FROM restock_order_items);--> statement-breakpoint
UPDATE labour_production_entries SET labourer_transaction_id = NULL WHERE labourer_transaction_id IS NOT NULL AND labourer_transaction_id NOT IN (SELECT id FROM labourer_transactions);--> statement-breakpoint
UPDATE miscellaneous_expenditures SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM misc_expenditure_categories);--> statement-breakpoint
DELETE FROM product_categories WHERE product_id NOT IN (SELECT id FROM products) OR category_id NOT IN (SELECT id FROM categories);--> statement-breakpoint
DELETE FROM supplier_products WHERE supplier_id NOT IN (SELECT id FROM suppliers) OR product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM labour_rates WHERE labourer_id NOT IN (SELECT id FROM labourers) OR product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM labour_production_consumption WHERE entry_id NOT IN (SELECT id FROM labour_production_entries) OR product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM recipe_items WHERE recipe_id NOT IN (SELECT id FROM recipes) OR ingredient_product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders) OR product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM restock_order_items WHERE restock_order_id NOT IN (SELECT id FROM restock_orders) OR product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM product_sales WHERE product_id NOT IN (SELECT id FROM products) OR customer_id NOT IN (SELECT id FROM customers);--> statement-breakpoint
DELETE FROM product_stock_history WHERE product_id NOT IN (SELECT id FROM products);--> statement-breakpoint
DELETE FROM ai_chat_messages WHERE session_id NOT IN (SELECT id FROM ai_chat_sessions);--> statement-breakpoint
DELETE FROM ai_chat_sessions WHERE user_id NOT IN (SELECT id FROM users);--> statement-breakpoint
DELETE FROM user_gemini_api_keys WHERE user_id NOT IN (SELECT id FROM users);--> statement-breakpoint

CREATE TABLE `__new_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`contact` text NOT NULL,
	`udhar` real DEFAULT 0 NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "name", "address", "contact", "udhar", "created_by_id", "created_at", "updated_at") SELECT "id", "name", "address", "contact", "udhar", "created_by_id", "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
CREATE UNIQUE INDEX `customers_contact_unique` ON `customers` (`contact`);--> statement-breakpoint

CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "name", "parent_id", "sort_order", "created_at", "updated_at") SELECT "id", "name", "parent_id", "sort_order", "created_at", "updated_at" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_parent_name_idx` ON `categories` (`parent_id`,`name`);--> statement-breakpoint

CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` real NOT NULL,
	`stock_qty` integer DEFAULT 0 NOT NULL,
	`in_stock` integer DEFAULT false NOT NULL,
	`purchase_price` real,
	`discount` real DEFAULT 0,
	`unit_id` text DEFAULT 'unit-pcs' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "category", "price", "stock_qty", "in_stock", "purchase_price", "discount", "unit_id", "created_at", "updated_at") SELECT "id", "name", "category", "price", "stock_qty", "in_stock", "purchase_price", "discount", "unit_id", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint

CREATE TABLE `__new_product_categories` (
	`product_id` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_product_categories`("product_id", "category_id", "created_at") SELECT "product_id", "category_id", "created_at" FROM `product_categories`;--> statement-breakpoint
DROP TABLE `product_categories`;--> statement-breakpoint
ALTER TABLE `__new_product_categories` RENAME TO `product_categories`;--> statement-breakpoint

CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`order_number` integer,
	`price` real DEFAULT 0,
	`payment` real,
	`refunded` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0,
	`charges` real DEFAULT 0 NOT NULL,
	`additional_charges_json` text DEFAULT '[]' NOT NULL,
	`additional_discounts_json` text DEFAULT '[]' NOT NULL,
	`invoice_breakdown` integer DEFAULT true NOT NULL,
	`status` text,
	`order_mode` text DEFAULT 'delayed' NOT NULL,
	`stock_deducted` integer DEFAULT false NOT NULL,
	`delivery_status` integer DEFAULT false,
	`delivery_date` integer,
	`returned_at` integer,
	`last_payment_reminder_at` integer,
	`message` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "customer_id", "order_number", "price", "payment", "refunded", "discount", "charges", "additional_charges_json", "additional_discounts_json", "invoice_breakdown", "status", "order_mode", "stock_deducted", "delivery_status", "delivery_date", "returned_at", "last_payment_reminder_at", "message", "created_by_id", "created_at", "updated_at") SELECT "id", "customer_id", "order_number", "price", "payment", "refunded", "discount", "charges", "additional_charges_json", "additional_discounts_json", "invoice_breakdown", "status", "order_mode", "stock_deducted", "delivery_status", "delivery_date", "returned_at", "last_payment_reminder_at", "message", "created_by_id", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint

CREATE TABLE `__new_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`unit_price` real NOT NULL,
	`unit_discount` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_order_items`("id", "order_id", "product_id", "qty", "unit_price", "unit_discount", "created_at") SELECT "id", "order_id", "product_id", "qty", "unit_price", "unit_discount", "created_at" FROM `order_items`;--> statement-breakpoint
DROP TABLE `order_items`;--> statement-breakpoint
ALTER TABLE `__new_order_items` RENAME TO `order_items`;--> statement-breakpoint

CREATE TABLE `__new_customer_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`order_id` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`payment_mode` text DEFAULT 'cash' NOT NULL,
	`proof_image` text,
	`proof_image_public_id` text,
	`created_by_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_customer_transactions`("id", "customer_id", "order_id", "type", "amount", "description", "payment_mode", "proof_image", "proof_image_public_id", "created_by_id", "created_at") SELECT "id", "customer_id", "order_id", "type", "amount", "description", "payment_mode", "proof_image", "proof_image_public_id", "created_by_id", "created_at" FROM `customer_transactions`;--> statement-breakpoint
DROP TABLE `customer_transactions`;--> statement-breakpoint
ALTER TABLE `__new_customer_transactions` RENAME TO `customer_transactions`;--> statement-breakpoint

CREATE TABLE `__new_restock_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`reference_number` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`amount_paid` real DEFAULT 0 NOT NULL,
	`amount_refunded` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_by_id` text NOT NULL,
	`ordered_at` integer,
	`received_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_restock_orders`("id", "supplier_id", "reference_number", "status", "total_amount", "amount_paid", "amount_refunded", "notes", "created_by_id", "ordered_at", "received_at", "created_at", "updated_at") SELECT "id", "supplier_id", "reference_number", "status", "total_amount", "amount_paid", "amount_refunded", "notes", "created_by_id", "ordered_at", "received_at", "created_at", "updated_at" FROM `restock_orders`;--> statement-breakpoint
DROP TABLE `restock_orders`;--> statement-breakpoint
ALTER TABLE `__new_restock_orders` RENAME TO `restock_orders`;--> statement-breakpoint

CREATE TABLE `__new_restock_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`restock_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_ordered` integer NOT NULL,
	`qty_received` integer DEFAULT 0 NOT NULL,
	`qty_returned` integer DEFAULT 0 NOT NULL,
	`unit_cost` real NOT NULL,
	`line_total` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`restock_order_id`) REFERENCES `restock_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_restock_order_items`("id", "restock_order_id", "product_id", "qty_ordered", "qty_received", "qty_returned", "unit_cost", "line_total", "created_at") SELECT "id", "restock_order_id", "product_id", "qty_ordered", "qty_received", "qty_returned", "unit_cost", "line_total", "created_at" FROM `restock_order_items`;--> statement-breakpoint
DROP TABLE `restock_order_items`;--> statement-breakpoint
ALTER TABLE `__new_restock_order_items` RENAME TO `restock_order_items`;--> statement-breakpoint

CREATE TABLE `__new_product_stock_history` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`purchase_price` real NOT NULL,
	`restock_order_item_id` text,
	`recorded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restock_order_item_id`) REFERENCES `restock_order_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_product_stock_history`("id", "product_id", "qty", "purchase_price", "restock_order_item_id", "recorded_at", "created_at") SELECT "id", "product_id", "qty", "purchase_price", "restock_order_item_id", "recorded_at", "created_at" FROM `product_stock_history`;--> statement-breakpoint
DROP TABLE `product_stock_history`;--> statement-breakpoint
ALTER TABLE `__new_product_stock_history` RENAME TO `product_stock_history`;--> statement-breakpoint

CREATE TABLE `__new_supplier_products` (
	`supplier_id` text NOT NULL,
	`product_id` text NOT NULL,
	`supplier_sku` text,
	`unit_cost` real,
	`is_preferred` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`supplier_id`, `product_id`),
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_supplier_products`("supplier_id", "product_id", "supplier_sku", "unit_cost", "is_preferred", "created_at") SELECT "supplier_id", "product_id", "supplier_sku", "unit_cost", "is_preferred", "created_at" FROM `supplier_products`;--> statement-breakpoint
DROP TABLE `supplier_products`;--> statement-breakpoint
ALTER TABLE `__new_supplier_products` RENAME TO `supplier_products`;--> statement-breakpoint

CREATE TABLE `__new_supplier_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier_id` text NOT NULL,
	`restock_order_id` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`payment_mode` text DEFAULT 'cash' NOT NULL,
	`proof_image` text,
	`proof_image_public_id` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`restock_order_id`) REFERENCES `restock_orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_supplier_transactions`("id", "supplier_id", "restock_order_id", "type", "amount", "description", "payment_mode", "proof_image", "proof_image_public_id", "created_by_id", "created_at") SELECT "id", "supplier_id", "restock_order_id", "type", "amount", "description", "payment_mode", "proof_image", "proof_image_public_id", "created_by_id", "created_at" FROM `supplier_transactions`;--> statement-breakpoint
DROP TABLE `supplier_transactions`;--> statement-breakpoint
ALTER TABLE `__new_supplier_transactions` RENAME TO `supplier_transactions`;--> statement-breakpoint

CREATE TABLE `__new_labourer_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`labourer_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`labourer_id`) REFERENCES `labourers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_labourer_transactions`("id", "labourer_id", "category", "amount", "description", "created_by_id", "created_at") SELECT "id", "labourer_id", "category", "amount", "description", "created_by_id", "created_at" FROM `labourer_transactions`;--> statement-breakpoint
DROP TABLE `labourer_transactions`;--> statement-breakpoint
ALTER TABLE `__new_labourer_transactions` RENAME TO `labourer_transactions`;--> statement-breakpoint

CREATE TABLE `__new_labour_rates` (
	`labourer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rate_per_unit` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`labourer_id`, `product_id`),
	FOREIGN KEY (`labourer_id`) REFERENCES `labourers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_labour_rates`("labourer_id", "product_id", "rate_per_unit", "created_at", "updated_at") SELECT "labourer_id", "product_id", "rate_per_unit", "created_at", "updated_at" FROM `labour_rates`;--> statement-breakpoint
DROP TABLE `labour_rates`;--> statement-breakpoint
ALTER TABLE `__new_labour_rates` RENAME TO `labour_rates`;--> statement-breakpoint

CREATE TABLE `__new_labour_production_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`labourer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_produced` integer NOT NULL,
	`rate_per_unit` real NOT NULL,
	`total_pay` real NOT NULL,
	`recipe_applied` integer DEFAULT false NOT NULL,
	`labourer_transaction_id` text,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`labourer_id`) REFERENCES `labourers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`labourer_transaction_id`) REFERENCES `labourer_transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_labour_production_entries`("id", "labourer_id", "product_id", "qty_produced", "rate_per_unit", "total_pay", "recipe_applied", "labourer_transaction_id", "notes", "created_by_id", "created_at") SELECT "id", "labourer_id", "product_id", "qty_produced", "rate_per_unit", "total_pay", "recipe_applied", "labourer_transaction_id", "notes", "created_by_id", "created_at" FROM `labour_production_entries`;--> statement-breakpoint
DROP TABLE `labour_production_entries`;--> statement-breakpoint
ALTER TABLE `__new_labour_production_entries` RENAME TO `labour_production_entries`;--> statement-breakpoint

CREATE TABLE `__new_labour_production_consumption` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_consumed` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `labour_production_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_labour_production_consumption`("id", "entry_id", "product_id", "qty_consumed", "created_at") SELECT "id", "entry_id", "product_id", "qty_consumed", "created_at" FROM `labour_production_consumption`;--> statement-breakpoint
DROP TABLE `labour_production_consumption`;--> statement-breakpoint
ALTER TABLE `__new_labour_production_consumption` RENAME TO `labour_production_consumption`;--> statement-breakpoint

CREATE TABLE `__new_product_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`stock_qty_left` integer NOT NULL,
	`sold` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_product_sales`("id", "product_id", "customer_id", "stock_qty_left", "sold", "created_at") SELECT "id", "product_id", "customer_id", "stock_qty_left", "sold", "created_at" FROM `product_sales`;--> statement-breakpoint
DROP TABLE `product_sales`;--> statement-breakpoint
ALTER TABLE `__new_product_sales` RENAME TO `product_sales`;--> statement-breakpoint

CREATE TABLE `__new_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`output_product_id` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`output_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recipes`("id", "output_product_id", "notes", "created_at", "updated_at") SELECT "id", "output_product_id", "notes", "created_at", "updated_at" FROM `recipes`;--> statement-breakpoint
DROP TABLE `recipes`;--> statement-breakpoint
ALTER TABLE `__new_recipes` RENAME TO `recipes`;--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_output_product_idx` ON `recipes` (`output_product_id`);--> statement-breakpoint

CREATE TABLE `__new_recipe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_product_id` text NOT NULL,
	`qty` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_recipe_items`("id", "recipe_id", "ingredient_product_id", "qty", "created_at") SELECT "id", "recipe_id", "ingredient_product_id", "qty", "created_at" FROM `recipe_items`;--> statement-breakpoint
DROP TABLE `recipe_items`;--> statement-breakpoint
ALTER TABLE `__new_recipe_items` RENAME TO `recipe_items`;--> statement-breakpoint

CREATE TABLE `__new_ai_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_chat_sessions`("id", "user_id", "title", "created_at", "updated_at") SELECT "id", "user_id", "title", "created_at", "updated_at" FROM `ai_chat_sessions`;--> statement-breakpoint
DROP TABLE `ai_chat_sessions`;--> statement-breakpoint
ALTER TABLE `__new_ai_chat_sessions` RENAME TO `ai_chat_sessions`;--> statement-breakpoint

CREATE TABLE `__new_ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`response_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `ai_chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_ai_chat_messages`("id", "session_id", "role", "content", "response_json", "created_at") SELECT "id", "session_id", "role", "content", "response_json", "created_at" FROM `ai_chat_messages`;--> statement-breakpoint
DROP TABLE `ai_chat_messages`;--> statement-breakpoint
ALTER TABLE `__new_ai_chat_messages` RENAME TO `ai_chat_messages`;--> statement-breakpoint

CREATE TABLE `__new_user_gemini_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_gemini_api_keys`("id", "user_id", "api_key", "model", "created_at", "updated_at") SELECT "id", "user_id", "api_key", "model", "created_at", "updated_at" FROM `user_gemini_api_keys`;--> statement-breakpoint
DROP TABLE `user_gemini_api_keys`;--> statement-breakpoint
ALTER TABLE `__new_user_gemini_api_keys` RENAME TO `user_gemini_api_keys`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_gemini_api_keys_user_id_unique` ON `user_gemini_api_keys` (`user_id`);--> statement-breakpoint

CREATE TABLE `__new_miscellaneous_expenditures` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` real NOT NULL,
	`payment_mode` text DEFAULT 'cash' NOT NULL,
	`note` text NOT NULL,
	`category_id` text,
	`proof_image` text,
	`proof_image_public_id` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `misc_expenditure_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_miscellaneous_expenditures`("id", "amount", "payment_mode", "note", "category_id", "proof_image", "proof_image_public_id", "created_by_id", "created_at", "updated_at") SELECT "id", "amount", "payment_mode", "note", "category_id", "proof_image", "proof_image_public_id", "created_by_id", "created_at", "updated_at" FROM `miscellaneous_expenditures`;--> statement-breakpoint
DROP TABLE `miscellaneous_expenditures`;--> statement-breakpoint
ALTER TABLE `__new_miscellaneous_expenditures` RENAME TO `miscellaneous_expenditures`;--> statement-breakpoint

CREATE TABLE `__new_product_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`input_product_id` text NOT NULL,
	`output_product_id` text NOT NULL,
	`input_ratio` real NOT NULL,
	`output_ratio` real NOT NULL,
	`input_qty` integer NOT NULL,
	`output_qty` integer NOT NULL,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`input_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`output_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_product_conversions`("id", "input_product_id", "output_product_id", "input_ratio", "output_ratio", "input_qty", "output_qty", "notes", "created_by_id", "created_at") SELECT "id", "input_product_id", "output_product_id", "input_ratio", "output_ratio", "input_qty", "output_qty", "notes", "created_by_id", "created_at" FROM `product_conversions`;--> statement-breakpoint
DROP TABLE `product_conversions`;--> statement-breakpoint
ALTER TABLE `__new_product_conversions` RENAME TO `product_conversions`;--> statement-breakpoint

PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
