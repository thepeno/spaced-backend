export const schemaString = `
CREATE TABLE \`card_contents\` (
	\`card_id\` text PRIMARY KEY NOT NULL,
	\`front\` text NOT NULL,
	\`back\` text NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`seq_no\` integer NOT NULL,
	\`last_modified_client\` text NOT NULL,
	FOREIGN KEY (\`card_id\`) REFERENCES \`cards\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`last_modified_client\`) REFERENCES \`clients\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`card_decks\` (
	\`card_id\` text NOT NULL,
	\`deck_id\` text NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`seq_no\` integer NOT NULL,
	\`cl_count\` integer DEFAULT 0 NOT NULL,
	\`user_id\` text NOT NULL,
	PRIMARY KEY(\`card_id\`, \`deck_id\`),
	FOREIGN KEY (\`card_id\`) REFERENCES \`cards\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`deck_id\`) REFERENCES \`decks\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`card_deleted\` (
	\`card_id\` text PRIMARY KEY NOT NULL,
	\`deleted\` integer DEFAULT true NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`seq_no\` integer NOT NULL,
	\`last_modified_client\` text NOT NULL,
	FOREIGN KEY (\`card_id\`) REFERENCES \`cards\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`last_modified_client\`) REFERENCES \`clients\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`cards\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`seq_no\` integer NOT NULL,
	\`user_id\` text NOT NULL,
	\`last_modified_client\` text NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`last_modified_client\`) REFERENCES \`clients\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`clients\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`user_id\` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`user_id_idx\` ON \`clients\` (\`user_id\`,\`id\`);--> statement-breakpoint
CREATE TABLE \`decks\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`name\` text NOT NULL,
	\`description\` text NOT NULL,
	\`deleted\` integer DEFAULT false NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`seq_no\` integer NOT NULL,
	\`user_id\` text NOT NULL,
	\`last_modified_client\` text NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`last_modified_client\`) REFERENCES \`clients\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`users\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`last_modified\` integer DEFAULT (current_timestamp) NOT NULL,
	\`username\` text NOT NULL,
	\`email\` text NOT NULL,
	\`password_hash\` text NOT NULL,
	\`next_seq_no\` integer DEFAULT 1 NOT NULL
);
;
`;
