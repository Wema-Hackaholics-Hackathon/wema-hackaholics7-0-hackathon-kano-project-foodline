CREATE TABLE `bank_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`mono_tx_id` text,
	`narration` text NOT NULL,
	`amount_kobo` integer NOT NULL,
	`type` text NOT NULL,
	`balance_kobo` integer,
	`date` text NOT NULL,
	`category` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bank_tx_customer_idx` ON `bank_transactions` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bank_tx_mono_idx` ON `bank_transactions` (`customer_id`,`mono_tx_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`bvn` text NOT NULL,
	`dob` text NOT NULL,
	`employer_name` text NOT NULL,
	`work_email` text NOT NULL,
	`address` text,
	`stage` text DEFAULT 'profile' NOT NULL,
	`mono_customer_id` text,
	`mono_account_id` text,
	`account_name` text,
	`account_number` text,
	`bank_name` text,
	`bank_code` text,
	`bank_nip_code` text,
	`data_status` text,
	`salary_amount_kobo` integer,
	`salary_months` integer,
	`salary_day_of_month` integer,
	`salary_employer_guess` text,
	`next_pay_date` text,
	`salary_verified_at` integer,
	`credit_limit_kobo` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `debit_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`installment_id` text NOT NULL,
	`loan_id` text NOT NULL,
	`reference` text NOT NULL,
	`amount_kobo` integer NOT NULL,
	`status` text NOT NULL,
	`trigger` text NOT NULL,
	`response_code` text,
	`message` text,
	`mono_session_id` text,
	`fee_kobo` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `debit_attempts_ref_idx` ON `debit_attempts` (`reference`);--> statement-breakpoint
CREATE INDEX `debit_attempts_installment_idx` ON `debit_attempts` (`installment_id`);--> statement-breakpoint
CREATE TABLE `inflow_events` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`amount_kobo` integer NOT NULL,
	`narration` text,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`matched_salary` integer DEFAULT false NOT NULL,
	`processed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inflow_customer_idx` ON `inflow_events` (`customer_id`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`seq` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount_kobo` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`paid_at` integer,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `installments_loan_idx` ON `installments` (`loan_id`);--> statement-breakpoint
CREATE INDEX `installments_due_idx` ON `installments` (`due_date`,`status`);--> statement-breakpoint
CREATE TABLE `ledger_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`customer_id` text,
	`loan_id` text,
	`order_id` text,
	`actor` text DEFAULT 'system' NOT NULL,
	`message` text NOT NULL,
	`data` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ledger_type_idx` ON `ledger_events` (`type`);--> statement-breakpoint
CREATE INDEX `ledger_customer_idx` ON `ledger_events` (`customer_id`);--> statement-breakpoint
CREATE INDEX `ledger_created_idx` ON `ledger_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`order_id` text NOT NULL,
	`mandate_id` text NOT NULL,
	`principal_kobo` integer NOT NULL,
	`margin_bps` integer NOT NULL,
	`total_repayable_kobo` integer NOT NULL,
	`installments_count` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mandate_id`) REFERENCES `mandates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `loans_customer_idx` ON `loans` (`customer_id`);--> statement-breakpoint
CREATE INDEX `loans_status_idx` ON `loans` (`status`);--> statement-breakpoint
CREATE TABLE `mandates` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`mono_mandate_id` text,
	`reference` text NOT NULL,
	`status` text DEFAULT 'initiated' NOT NULL,
	`ready_to_debit` integer DEFAULT false NOT NULL,
	`amount_cap_kobo` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`nibss_code` text,
	`transfer_destinations` text,
	`account_name` text,
	`account_number` text,
	`bank_name` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	`ready_at` integer,
	`cancelled_at` integer,
	`status_message` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mandates_customer_idx` ON `mandates` (`customer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `mandates_ref_idx` ON `mandates` (`reference`);--> statement-breakpoint
CREATE INDEX `mandates_mono_idx` ON `mandates` (`mono_mandate_id`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_unit_id` text NOT NULL,
	`product_name` text NOT NULL,
	`unit_label` text NOT NULL,
	`unit_price_kobo` integer NOT NULL,
	`qty` integer NOT NULL,
	`line_total_kobo` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'issued' NOT NULL,
	`total_kobo` integer NOT NULL,
	`voucher_code` text NOT NULL,
	`qr_token` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`redeemed_at` integer,
	`redeemed_by_retailer_id` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by_retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_voucher_idx` ON `orders` (`voucher_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_qr_idx` ON `orders` (`qr_token`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE TABLE `product_units` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`unit_label` text NOT NULL,
	`price_kobo` integer NOT NULL,
	`stock_qty` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_units_product_idx` ON `product_units` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`image_key` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category`);--> statement-breakpoint
CREATE TABLE `retailers` (
	`id` text PRIMARY KEY NOT NULL,
	`business_name` text NOT NULL,
	`contact_phone` text,
	`address` text,
	`settlement_bank_code` text NOT NULL,
	`settlement_bank_name` text NOT NULL,
	`settlement_account_number` text NOT NULL,
	`settlement_account_name` text NOT NULL,
	`paystack_recipient_code` text,
	`active` integer DEFAULT true NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `salary_detections` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`eligible` integer NOT NULL,
	`avg_amount_kobo` integer,
	`months_found` integer,
	`pay_day_of_month` integer,
	`employer_guess` text,
	`next_pay_date` text,
	`evidence` text NOT NULL,
	`reasons` text NOT NULL,
	`config_snapshot` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `salary_det_customer_idx` ON `salary_detections` (`customer_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`retailer_id` text NOT NULL,
	`amount_kobo` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paystack_transfer_code` text,
	`reference` text NOT NULL,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	`settled_at` integer,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retailer_id`) REFERENCES `retailers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlements_ref_idx` ON `settlements` (`reference`);--> statement-breakpoint
CREATE INDEX `settlements_retailer_idx` ON `settlements` (`retailer_id`);--> statement-breakpoint
CREATE INDEX `settlements_order_idx` ON `settlements` (`order_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_id` text,
	`event` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`received_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_dedupe_idx` ON `webhook_events` (`provider`,`event_id`);