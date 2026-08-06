CREATE TABLE `ai_chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`response_json` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `ai_chat_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New chat' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_transactions` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`contact` text NOT NULL,
	`udhar` real DEFAULT 0 NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_contact_unique` ON `customers` (`contact`);--> statement-breakpoint
CREATE TABLE `labour_production_consumption` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_consumed` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labour_production_entries` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labour_rates` (
	`labourer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rate_per_unit` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`labourer_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `labourer_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`labourer_id` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labourers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `miscellaneous_expenditures` (
	`id` text PRIMARY KEY NOT NULL,
	`amount` real NOT NULL,
	`payment_mode` text DEFAULT 'cash' NOT NULL,
	`note` text NOT NULL,
	`proof_image` text,
	`proof_image_public_id` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`unit_price` real NOT NULL,
	`unit_discount` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`order_number` integer,
	`price` real DEFAULT 0,
	`payment` real,
	`refunded` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0,
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
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`stock_qty_left` integer NOT NULL,
	`sold` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_stock_history` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`purchase_price` real NOT NULL,
	`restock_order_item_id` text,
	`recorded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
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
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_product_id` text NOT NULL,
	`qty` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`output_product_id` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_output_product_idx` ON `recipes` (`output_product_id`);--> statement-breakpoint
CREATE TABLE `restock_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`restock_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_ordered` integer NOT NULL,
	`qty_received` integer DEFAULT 0 NOT NULL,
	`qty_returned` integer DEFAULT 0 NOT NULL,
	`unit_cost` real NOT NULL,
	`line_total` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `restock_orders` (
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
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_products` (
	`supplier_id` text NOT NULL,
	`product_id` text NOT NULL,
	`supplier_sku` text,
	`unit_cost` real,
	`is_preferred` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`supplier_id`, `product_id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_transactions` (
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
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`business_name` text,
	`address` text,
	`contact` text NOT NULL,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `units_name_unique` ON `units` (`name`);--> statement-breakpoint
CREATE TABLE `user_gemini_api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key` text NOT NULL,
	`model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_gemini_api_keys_user_id_unique` ON `user_gemini_api_keys` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`password` text,
	`role` text DEFAULT 'User' NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`avatar_public_id` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_contact_unique` ON `users` (`contact`);--> statement-breakpoint
CREATE TABLE `whatsapp_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`contact` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
