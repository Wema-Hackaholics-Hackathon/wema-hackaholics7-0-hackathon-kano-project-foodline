ALTER TABLE `customers` ADD `lat` real;--> statement-breakpoint
ALTER TABLE `customers` ADD `lng` real;--> statement-breakpoint
ALTER TABLE `customers` ADD `geo_label` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_retailer_id` text REFERENCES retailers(id);--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `orders` ADD `retailer_confirmed_at` integer;--> statement-breakpoint
CREATE INDEX `orders_pickup_idx` ON `orders` (`pickup_retailer_id`,`status`);--> statement-breakpoint
ALTER TABLE `retailers` ADD `lat` real;--> statement-breakpoint
ALTER TABLE `retailers` ADD `lng` real;--> statement-breakpoint
ALTER TABLE `retailers` ADD `geo_label` text;