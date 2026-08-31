PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_misc_expenditure_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `misc_expenditure_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_misc_expenditure_categories`("id", "name", "parent_id", "sort_order", "created_at", "updated_at")
SELECT "id", "name", NULL, 0, "created_at", "updated_at" FROM `misc_expenditure_categories`;--> statement-breakpoint
DROP TABLE `misc_expenditure_categories`;--> statement-breakpoint
ALTER TABLE `__new_misc_expenditure_categories` RENAME TO `misc_expenditure_categories`;--> statement-breakpoint
CREATE UNIQUE INDEX `misc_expenditure_categories_parent_name_idx` ON `misc_expenditure_categories` (`parent_id`, `name`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
