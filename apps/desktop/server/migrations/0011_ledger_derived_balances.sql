INSERT INTO `customer_transactions` (`id`, `customer_id`, `order_id`, `type`, `amount`, `description`, `payment_mode`, `created_by_id`, `created_at`)
SELECT
    lower(hex(randomblob(16))),
    `o`.`customer_id`,
    `o`.`id`,
    'order',
    max(`o`.`price` + coalesce(`o`.`charges`, 0) - coalesce(`o`.`discount`, 0), 0),
    'Order #' || coalesce(`o`.`order_number`, '') || ' — invoice',
    'cash',
    `o`.`created_by_id`,
    `o`.`created_at`
FROM `orders` AS `o`
WHERE `o`.`status` IN ('saved', 'cancelled', 'returned')
  AND max(`o`.`price` + coalesce(`o`.`charges`, 0) - coalesce(`o`.`discount`, 0), 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM `customer_transactions` AS `t`
      WHERE `t`.`order_id` = `o`.`id` AND `t`.`type` = 'order'
  );--> statement-breakpoint
INSERT INTO `customer_transactions` (`id`, `customer_id`, `order_id`, `type`, `amount`, `description`, `payment_mode`, `created_by_id`, `created_at`)
SELECT
    lower(hex(randomblob(16))),
    `o`.`customer_id`,
    `o`.`id`,
    'order_credit',
    max(`o`.`price` + coalesce(`o`.`charges`, 0) - coalesce(`o`.`discount`, 0), 0),
    'Order #' || coalesce(`o`.`order_number`, '') || ' — credit on ' || `o`.`status`,
    'cash',
    `o`.`created_by_id`,
    coalesce(`o`.`returned_at`, `o`.`updated_at`, `o`.`created_at`)
FROM `orders` AS `o`
WHERE `o`.`status` IN ('cancelled', 'returned')
  AND max(`o`.`price` + coalesce(`o`.`charges`, 0) - coalesce(`o`.`discount`, 0), 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM `customer_transactions` AS `t`
      WHERE `t`.`order_id` = `o`.`id` AND `t`.`type` = 'order_credit'
  );--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `udhar`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `payable`;
