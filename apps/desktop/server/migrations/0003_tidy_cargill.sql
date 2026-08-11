ALTER TABLE `orders` ADD `charges` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `additional_charges_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `additional_discounts_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_breakdown` integer DEFAULT true NOT NULL;