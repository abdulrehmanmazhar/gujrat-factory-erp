CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`output_product_id` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_output_product_idx` ON `recipes` (`output_product_id`);
--> statement-breakpoint
CREATE TABLE `recipe_items` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_product_id` text NOT NULL,
	`qty` real NOT NULL,
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
CREATE TABLE `labour_rates` (
	`labourer_id` text NOT NULL,
	`product_id` text NOT NULL,
	`rate_per_unit` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`labourer_id`, `product_id`)
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
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labour_production_consumption` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`product_id` text NOT NULL,
	`qty_consumed` real NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
