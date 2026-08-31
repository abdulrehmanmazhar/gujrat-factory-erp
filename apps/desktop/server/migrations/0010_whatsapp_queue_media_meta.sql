ALTER TABLE `whatsapp_queue` ADD `customer_id` text REFERENCES `customers`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `whatsapp_queue` ADD `order_id` text REFERENCES `orders`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `whatsapp_queue` ADD `transaction_id` text REFERENCES `customer_transactions`(`id`) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `whatsapp_queue` ADD `doc_type` text;--> statement-breakpoint
ALTER TABLE `whatsapp_queue` ADD `order_number` integer;--> statement-breakpoint
ALTER TABLE `whatsapp_queue` ADD `display_name` text;
