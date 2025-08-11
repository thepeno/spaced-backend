CREATE TABLE `card_example_sentences` (
	`user_id` text NOT NULL,
	`card_id` text NOT NULL,
	`example_sentence` text,
	`example_sentence_translation` text,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `card_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`card_id`) REFERENCES `cards`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `card_example_sentences_user_id_seq_no_modified_client_idx` ON `card_example_sentences` (`user_id`,`seq_no`,`last_modified_client`);--> statement-breakpoint
CREATE TABLE `deck_languages` (
	`user_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`native_language` text,
	`target_language` text,
	`last_modified` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`seq_no` integer NOT NULL,
	`last_modified_client` text NOT NULL,
	PRIMARY KEY(`user_id`, `deck_id`),
	FOREIGN KEY (`last_modified_client`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`deck_id`) REFERENCES `decks`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `deck_languages_user_id_seq_no_modified_client_idx` ON `deck_languages` (`user_id`,`seq_no`,`last_modified_client`);