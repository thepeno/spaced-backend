CREATE TABLE `files` (
	`user_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`checksum` text NOT NULL,
	`file_type` text NOT NULL,
	`metadata` text NOT NULL,
	`size_in_bytes` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `files_user_id` ON `files` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `files_userid_checksum_idx` ON `files` (`user_id`,`checksum`);--> statement-breakpoint
CREATE TABLE `user_storage_metrics` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`total_files` integer DEFAULT 0 NOT NULL,
	`total_size_in_bytes` integer DEFAULT 0 NOT NULL,
	`storage_limit_in_bytes` integer DEFAULT 104857600 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Below is all the manually written migration code
-- Create a row for each user in the user_storage_metrics table
INSERT INTO `user_storage_metrics` (`user_id`)
SELECT `id` FROM `users`;--> statement-breakpoint

-- Before inserting a file, check if the storage limit is exceeded
CREATE TRIGGER IF NOT EXISTS `check_user_storage_metrics_limit_trigger`
BEFORE INSERT ON `files`
FOR EACH ROW
WHEN (
    (SELECT total_size_in_bytes + NEW.size_in_bytes FROM user_storage_metrics WHERE user_id = NEW.user_id) >
    (SELECT storage_limit_in_bytes FROM user_storage_metrics WHERE user_id = NEW.user_id)
)
BEGIN
    SELECT RAISE(ABORT, 'Storage limit exceeded');
END; --> statement-breakpoint

-- We're assuming that the other trigger will prevent the insert from happening if the storage limit is exceeded
-- After inserting a file, update the total size usage
CREATE TRIGGER IF NOT EXISTS `insert_file_update_user_storage_metrics_trigger`
AFTER INSERT ON `files`
FOR EACH ROW
BEGIN
	UPDATE `user_storage_metrics` SET `total_size_in_bytes` = `total_size_in_bytes` + NEW.`size_in_bytes` WHERE `user_id` = NEW.`user_id`;
END;--> statement-breakpoint

-- After deleting a file, update the total size usage
CREATE TRIGGER IF NOT EXISTS `delete_file_update_user_storage_metrics_trigger`
AFTER DELETE ON `files`
FOR EACH ROW
BEGIN
	UPDATE `user_storage_metrics` SET `total_size_in_bytes` = `total_size_in_bytes` - OLD.`size_in_bytes` WHERE `user_id` = OLD.`user_id`;
END;--> statement-breakpoint
