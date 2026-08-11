CREATE TABLE `product_conversions` (
	`id` text PRIMARY KEY NOT NULL,
	`input_product_id` text NOT NULL,
	`output_product_id` text NOT NULL,
	`input_ratio` real NOT NULL,
	`output_ratio` real NOT NULL,
	`input_qty` integer NOT NULL,
	`output_qty` integer NOT NULL,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
