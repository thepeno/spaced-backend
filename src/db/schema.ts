import { sql } from 'drizzle-orm';
import { integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	lastModified: integer('last_modified', { mode: 'timestamp' })
		.notNull()
		.default(sql`(current_timestamp)`),
	username: text('username').notNull(),
	email: text('email').notNull(),
	passwordHash: text('password_hash').notNull(),
	nextSeqNo: integer('next_seq_no').notNull().default(1),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const clients = sqliteTable(
	'clients',
	{
		id: text('id').primaryKey(),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		userId: text('user_id').notNull(),
	},
	(table) => [unique('user_id_idx').on(table.userId, table.id)]
);

export const cards = sqliteTable('cards', {
	id: text('id').primaryKey(),
	lastModified: integer('last_modified', { mode: 'timestamp' })
		.notNull()
		.default(sql`(current_timestamp)`),
	seqNo: integer('seq_no').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	lastModifiedClient: text('last_modified_client')
		.notNull()
		.references(() => clients.id),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

export const cardContents = sqliteTable('card_contents', {
	cardId: text('card_id')
		.primaryKey()
		.references(() => cards.id),
	front: text('front').notNull(),
	back: text('back').notNull(),
	lastModified: integer('last_modified', { mode: 'timestamp' })
		.notNull()
		.default(sql`(current_timestamp)`),
	seqNo: integer('seq_no').notNull(),
	lastModifiedClient: text('last_modified_client')
		.notNull()
		.references(() => clients.id),
});

export type CardContent = typeof cardContents.$inferSelect;

export const cardDeleted = sqliteTable('card_deleted', {
	cardId: text('card_id')
		.primaryKey()
		.references(() => cards.id),
	deleted: integer('deleted', { mode: 'boolean' }).notNull().default(true),
	lastModified: integer('last_modified', { mode: 'timestamp' })
		.notNull()
		.default(sql`(current_timestamp)`),
	seqNo: integer('seq_no').notNull(),
	lastModifiedClient: text('last_modified_client')
		.notNull()
		.references(() => clients.id),
});

export type CardDeleted = typeof cardDeleted.$inferSelect;

export const decks = sqliteTable('decks', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description').notNull(),
	deleted: integer('deleted', { mode: 'boolean' }).notNull().default(false),
	lastModified: integer('last_modified', { mode: 'timestamp' })
		.notNull()
		.default(sql`(current_timestamp)`),
	seqNo: integer('seq_no').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	lastModifiedClient: text('last_modified_client')
		.notNull()
		.references(() => clients.id),
});

export type Deck = typeof decks.$inferSelect;

export const cardDecks = sqliteTable(
	'card_decks',
	{
		cardId: text('card_id')
			.notNull()
			.references(() => cards.id),
		deckId: text('deck_id')
			.notNull()
			.references(() => decks.id),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		seqNo: integer('seq_no').notNull(),
		clCount: integer('cl_count').notNull().default(0),
		lastModifiedClient: text('last_modified_client')
			.notNull()
			.references(() => clients.id),
	},
	(table) => [
		primaryKey({
			columns: [table.cardId, table.deckId],
		}),
	]
);

export type CardDeck = typeof cardDecks.$inferSelect;
