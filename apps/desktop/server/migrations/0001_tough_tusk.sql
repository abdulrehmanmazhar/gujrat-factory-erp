CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_parent_name_idx` ON `categories` (`parent_id`,`name`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`)
);
--> statement-breakpoint
INSERT INTO `categories` (`id`, `name`, `parent_id`, `sort_order`, `created_at`, `updated_at`)
SELECT
	lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
	trim(`category`),
	NULL,
	0,
	cast(unixepoch('subsecond') * 1000 as integer),
	cast(unixepoch('subsecond') * 1000 as integer)
FROM `products`
WHERE trim(`category`) != ''
GROUP BY trim(`category`);
--> statement-breakpoint
INSERT INTO `product_categories` (`product_id`, `category_id`, `created_at`)
SELECT
	p.`id`,
	c.`id`,
	cast(unixepoch('subsecond') * 1000 as integer)
FROM `products` p
INNER JOIN `categories` c ON c.`name` = trim(p.`category`) AND c.`parent_id` IS NULL
WHERE trim(p.`category`) != '';
