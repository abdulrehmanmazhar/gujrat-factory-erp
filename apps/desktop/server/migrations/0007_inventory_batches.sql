-- Inventory FIFO batches + opening-balance backfill
CREATE TABLE `inventory_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_ref_id` text,
	`restock_order_item_id` text,
	`labour_production_entry_id` text,
	`conversion_id` text,
	`supplier_id` text,
	`labourer_id` text,
	`original_qty` integer NOT NULL,
	`remaining_qty` integer NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`received_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`restock_order_item_id`) REFERENCES `restock_order_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`labourer_id`) REFERENCES `labourers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `inventory_batch_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty` integer NOT NULL,
	`unit_cost` real NOT NULL,
	`reason` text NOT NULL,
	`order_id` text,
	`product_sale_id` text,
	`labour_production_entry_id` text,
	`conversion_id` text,
	`restock_order_item_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_sale_id`) REFERENCES `product_sales`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`restock_order_item_id`) REFERENCES `restock_order_items`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inventory_batches_product_remaining_idx` ON `inventory_batches` (`product_id`, `remaining_qty`, `received_at`);
--> statement-breakpoint
CREATE INDEX `inventory_batch_allocations_order_idx` ON `inventory_batch_allocations` (`order_id`, `reason`);
--> statement-breakpoint
CREATE INDEX `inventory_batch_allocations_created_idx` ON `inventory_batch_allocations` (`created_at`, `reason`);
--> statement-breakpoint
INSERT INTO `inventory_batches` (
	`id`,
	`product_id`,
	`source_type`,
	`original_qty`,
	`remaining_qty`,
	`unit_cost`,
	`received_at`,
	`notes`,
	`created_at`
)
SELECT
	lower(hex(randomblob(16))),
	`id`,
	'opening',
	`stock_qty`,
	`stock_qty`,
	COALESCE(`purchase_price`, 0),
	CAST(unixepoch('subsecond') * 1000 AS integer),
	'Opening balance migrated from legacy stock',
	CAST(unixepoch('subsecond') * 1000 AS integer)
FROM `products`
WHERE `stock_qty` > 0;
