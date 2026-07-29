ALTER TABLE `customers` ADD `state` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `lga` text;--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_cost_kobo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `line_cost_kobo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product_units` ADD `cost_kobo` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `retailer_id` text REFERENCES retailers(id);--> statement-breakpoint
ALTER TABLE `products` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `suggested_markup_bps` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `markup_bps` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `products` ADD `submitted_by` text;--> statement-breakpoint
ALTER TABLE `products` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `products` ADD `reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `products_retailer_idx` ON `products` (`retailer_id`,`status`);--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);--> statement-breakpoint
ALTER TABLE `retailers` ADD `owner_name` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `state` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `lga` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `rc_number` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `business_type` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `years_trading` integer;--> statement-breakpoint
ALTER TABLE `retailers` ADD `description` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `bank_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `retailers` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `retailers` ADD `rejection_reason` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `retailers` ADD `reviewed_at` integer;--> statement-breakpoint
CREATE INDEX `retailers_status_idx` ON `retailers` (`status`);--> statement-breakpoint
CREATE INDEX `retailers_area_idx` ON `retailers` (`state`,`lga`);--> statement-breakpoint
ALTER TABLE `settlements` ADD `markup_kobo` integer DEFAULT 0 NOT NULL;