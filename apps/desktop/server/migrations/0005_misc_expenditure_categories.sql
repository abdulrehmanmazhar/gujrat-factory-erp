CREATE TABLE `misc_expenditure_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `misc_expenditure_categories_name_unique` ON `misc_expenditure_categories` (`name`);
--> statement-breakpoint
ALTER TABLE `miscellaneous_expenditures` ADD `category_id` text;
