CREATE TABLE `temp_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`token` text NOT NULL,
	`token_expires_at` integer NOT NULL,
	`last_email_sent_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temp_users_email_idx` ON `temp_users` (`email`);