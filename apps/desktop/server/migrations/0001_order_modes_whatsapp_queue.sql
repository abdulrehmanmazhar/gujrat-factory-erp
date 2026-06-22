ALTER TABLE `orders` ADD COLUMN `order_mode` text DEFAULT 'delayed' NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `stock_deducted` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD COLUMN `returned_at` integer;
--> statement-breakpoint
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
