CREATE TABLE `card_bookmarked` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`bookmarked` integer DEFAULT false NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_bookmarked_user_id_seq_no_modified_client_idx` ON `card_bookmarked` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `card_contents` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_contents_user_id_seq_no_modified_client_idx` ON `card_contents` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `card_decks` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`cl_count` integer DEFAULT 0 NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`, `deck_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`deck_id`) REFERENCES `decks`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_decks_user_id_seq_no_modified_client_idx` ON `card_decks` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `card_deleted` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`deleted` integer DEFAULT true NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_deleted_user_id_seq_no_modified_client_idx` ON `card_deleted` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `card_suspended` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`suspended` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_suspended_user_id_seq_no_modified_client_idx` ON `card_suspended` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`user_id` text NOT NULL,
	`last_modified_client` text NOT NULL,
	`due` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`state` text NOT NULL,
	`last_review` integer,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cards_user_id_idx` ON `cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `cards_user_id_seq_no_modified_client_idx` ON `cards` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`user_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_user_id_idx` ON `clients` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `decks` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `decks_user_id_idx` ON `decks` (`user_id`);--> statement-breakpoint
CREATE INDEX `decks_user_id_seq_no_modified_client_idx` ON `decks` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_accounts_provider_provider_user_id_idx` ON `oauth_accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE TABLE `review_log_deleted` (
	`user_id` text NOT NULL,
	`review_log_id` text NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `review_log_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`review_log_id`) REFERENCES `review_logs`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_log_review_log_id_deleted_user_id_seq_no_modified_client_idx` ON `review_log_deleted` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	`grade` text NOT NULL,
	`state` text NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` integer NOT NULL,
	`last_elapsed_days` integer NOT NULL,
	`scheduled_days` integer NOT NULL,
	`review` integer NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_logs_user_id_card_id_idx` ON `review_logs` (`user_id`,`card_id`);--> statement-breakpoint
CREATE INDEX `review_logs_user_id_seq_no_modified_client_idx` ON `review_logs` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`valid` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`last_active_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`email` text NOT NULL,
	`image_url` text,
	`display_name` text,
	`is_active` integer DEFAULT true NOT NULL,
	`password_hash` text,
	`next_seq_no` integer DEFAULT 1 NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`password_reset_token` text,
	`password_reset_token_expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);