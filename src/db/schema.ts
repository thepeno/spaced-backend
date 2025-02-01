import { relations, sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	unique,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const states = ['New', 'Learning', 'Review', 'Relearning'] as const;
export type State = (typeof states)[number];

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		email: text('email').notNull(),
		// TODO: implement verification for registering email
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		passwordHash: text('password_hash').notNull(),
		nextSeqNo: integer('next_seq_no').notNull().default(1),
		failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
		passwordResetToken: text('password_reset_token'),
		passwordResetTokenExpiresAt: integer('password_reset_token_expires_at', {
			mode: 'timestamp',
		}),
	},
	(table) => [uniqueIndex('users_email_idx').on(table.email)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		valid: integer('valid', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		lastActiveAt: integer('last_active_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
	},
	(table) => [index('sessions_user_id_idx').on(table.userId)]
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const clients = sqliteTable(
	'clients',
	{
		id: text('id').primaryKey(),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		userId: text('user_id').notNull(),
	},
	(table) => [unique('clients_user_id_idx').on(table.userId, table.id)]
);

export const cards = sqliteTable(
	'cards',
	{
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

		// Variables for cards
		due: integer('due', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		stability: real('stability').notNull(),
		difficulty: real('difficulty').notNull(),
		elapsed_days: integer('elapsed_days').notNull(),
		scheduled_days: integer('scheduled_days').notNull(),
		reps: integer('reps').notNull(),
		lapses: integer('lapses').notNull(),
		state: text('state', { enum: states }).notNull(),
		last_review: integer('last_review', { mode: 'timestamp' }),
	},
	(table) => [
		index('cards_user_id_idx').on(table.userId),
		index('cards_user_id_seq_no_modified_client_idx').on(
			table.userId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;

export const cardContents = sqliteTable(
	'card_contents',
	{
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
	},
	(table) => [
		index('card_contents_card_id_idx').on(table.cardId),
		index('card_contents_card_id_seq_no_modified_client_idx').on(
			table.cardId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type CardContent = typeof cardContents.$inferSelect;

export const cardDeleted = sqliteTable(
	'card_deleted',
	{
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
	},
	(table) => [
		index('card_deleted_card_id_idx').on(table.cardId),
		index('card_deleted_card_id_seq_no_modified_client_idx').on(
			table.cardId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type CardDeleted = typeof cardDeleted.$inferSelect;

// We use LWW strategy for bookmarks rather than CLSet
// because it makes more sense that the latest operation is the one that the client
// wants to execute
// And someone might bookmark/unbookmark a card multiple times
// so we the incrementing counter for CLset does not best represent the intention of the user.
export const cardBookmarked = sqliteTable(
	'card_bookmarked',
	{
		cardId: text('card_id')
			.primaryKey()
			.references(() => cards.id),
		bookmarked: integer('bookmarked', { mode: 'boolean' }).notNull().default(false),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		seqNo: integer('seq_no').notNull(),
		lastModifiedClient: text('last_modified_client')
			.notNull()
			.references(() => clients.id),
	},
	(table) => [
		index('card_bookmarked_card_id_idx').on(table.cardId),
		index('card_bookmarked_card_id_seq_no_modified_client_idx').on(
			table.cardId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type CardBookmarked = typeof cardBookmarked.$inferSelect;

export const cardSuspended = sqliteTable(
	'card_suspended',
	{
		cardId: text('card_id')
			.primaryKey()
			.references(() => cards.id),
		suspended: integer('suspended', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		lastModified: integer('last_modified', { mode: 'timestamp' })
			.notNull()
			.default(sql`(current_timestamp)`),
		seqNo: integer('seq_no').notNull(),
		lastModifiedClient: text('last_modified_client')
			.notNull()
			.references(() => clients.id),
	},
	(table) => [
		index('card_suspended_card_id_idx').on(table.cardId),
		index('card_suspended_card_id_seq_no_modified_client_idx').on(
			table.cardId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type CardSuspended = typeof cardSuspended.$inferSelect;

export const decks = sqliteTable(
	'decks',
	{
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
	},
	(table) => [
		index('decks_user_id_idx').on(table.userId),
		index('decks_user_id_seq_no_modified_client_idx').on(
			table.userId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

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
		index('card_decks_card_id_idx').on(table.cardId),
		index('card_decks_deck_id_idx').on(table.deckId),
		index('card_decks_card_id_deck_id_seq_no_modified_client_idx').on(
			table.deckId,
			table.cardId,
			table.seqNo,
			table.lastModifiedClient
		),
	]
);

export type CardDeck = typeof cardDecks.$inferSelect;

// Relations

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	clients: many(clients),
	cards: many(cards),
	decks: many(decks),
}));

export const clientsRelations = relations(clients, ({ one }) => ({
	user: one(users, {
		fields: [clients.userId],
		references: [users.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
	user: one(users, {
		fields: [cards.userId],
		references: [users.id],
	}),
	cardContents: one(cardContents),
	cardDeleted: one(cardDeleted),
}));

export const cardContentsRelations = relations(cardContents, ({ one }) => ({
	card: one(cards, {
		fields: [cardContents.cardId],
		references: [cards.id],
	}),
}));

export const cardDeletedRelations = relations(cardDeleted, ({ one }) => ({
	card: one(cards, {
		fields: [cardDeleted.cardId],
		references: [cards.id],
	}),
}));

export const decksRelations = relations(decks, ({ many, one }) => ({
	cardDecks: many(cardDecks),
	user: one(users, {
		fields: [decks.userId],
		references: [users.id],
	}),
}));

export const cardDecksRelations = relations(cardDecks, ({ one }) => ({
	card: one(cards, {
		fields: [cardDecks.cardId],
		references: [cards.id],
	}),
	deck: one(decks, {
		fields: [cardDecks.deckId],
		references: [decks.id],
	}),
}));
