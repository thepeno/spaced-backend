import { DB } from '@/db';
import * as schema from '@/db/schema';
import { Card } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';

type StripMetadata<T> = Omit<T, 'seqNo' | 'lastModifiedClient' | 'userId' | 'lastModified'>;

export type CardOperation = {
	type: 'card';
	payload: StripMetadata<Card>;
	timestamp: number;
	clientId: string;
};

export type CardContentOperation = {
	type: 'cardContent';
	payload: StripMetadata<schema.CardContent>;
	timestamp: number;
	clientId: string;
};

export type CardDeletedOperation = {
	type: 'cardDeleted';
	payload: StripMetadata<schema.CardDeleted>;
	timestamp: number;
	clientId: string;
};

export type DeckOperation = {
	type: 'deck';
	payload: StripMetadata<schema.Deck>;
	timestamp: number;
	clientId: string;
};

// TODO: the last write wins logic can be abstracted out into something
// that's more generic and reusable between all LastWriteWins tables
export type Operation = CardOperation | CardContentOperation | CardDeletedOperation | DeckOperation;

/**
 * Reserves the next sequence numbers for the user.
 * This is okay as the sequence numbers only need to monotonically increase
 * and not necessarily be strictly consecutive.
 *
 * @param userId - The ID of the user.
 * @param db - The database connection.
 * @param length - The number of sequence numbers to reserve.
 * @returns The next sequence number after the reservation.
 */
async function reserveSeqNo(userId: string, db: D1Database, length: number): Promise<number> {
	const stmt = db.prepare(`
		UPDATE users
		SET next_seq_no = next_seq_no + ?
		WHERE id = ?
		RETURNING next_seq_no - ? AS next_seq_no
	`);

	const result = await stmt.bind(length, userId, length).first();

	if (!result) {
		throw new Error('Failed to reserve sequence number');
	}

	return result.next_seq_no as number;
}

export async function handleCardOperation(userId: string, op: CardOperation, db: DB, seqNo: number) {
	// Drizzle's transactions are not supported in D1
	// https://github.com/drizzle-team/drizzle-orm/issues/2463
	// so we reserve the sequence number separately first
	await db
		.insert(schema.cards)
		.values({
			lastModified: new Date(op.timestamp),
			lastModifiedClient: op.clientId,
			seqNo,
			id: op.payload.id,
			userId,
		})
		.onConflictDoUpdate({
			target: schema.cards.id,
			set: {
				seqNo,
				lastModifiedClient: op.clientId,
				lastModified: new Date(op.timestamp),
			},
			setWhere: sql`
		excluded.last_modified > ${schema.cards.lastModified}
		OR (excluded.last_modified = ${schema.cards.lastModified}
			AND excluded.last_modified_client > ${schema.cards.lastModifiedClient})
		`,
		});
}

export async function handleCardContentOperation(op: CardContentOperation, db: DB, seqNo: number) {
	await db
		.insert(schema.cardContents)
		.values({
			cardId: op.payload.cardId,
			front: op.payload.front,
			back: op.payload.back,
			lastModified: new Date(op.timestamp),
			lastModifiedClient: op.clientId,
			seqNo,
		})
		.onConflictDoUpdate({
			target: schema.cardContents.cardId,
			set: {
				front: op.payload.front,
				back: op.payload.back,
				lastModified: new Date(op.timestamp),
				lastModifiedClient: op.clientId,
			},
			setWhere: sql`
		excluded.last_modified > ${schema.cardContents.lastModified}
		OR (excluded.last_modified = ${schema.cardContents.lastModified}
			AND excluded.last_modified_client > ${schema.cardContents.lastModifiedClient})
		`,
		});
}

export async function handleCardDeletedOperation(op: CardDeletedOperation, db: DB, seqNo: number) {
	await db
		.insert(schema.cardDeleted)
		.values({
			cardId: op.payload.cardId,
			lastModified: new Date(op.timestamp),
			lastModifiedClient: op.clientId,
			seqNo,
			deleted: op.payload.deleted,
		})
		.onConflictDoUpdate({
			target: schema.cardDeleted.cardId,
			set: {
				lastModified: new Date(op.timestamp),
				lastModifiedClient: op.clientId,
				deleted: op.payload.deleted,
			},
			setWhere: sql`
		excluded.last_modified > ${schema.cardDeleted.lastModified}
		OR (excluded.last_modified = ${schema.cardDeleted.lastModified}
			AND excluded.last_modified_client > ${schema.cardDeleted.lastModifiedClient})
		`,
		});
}

export async function handleDeckOperation(userId: string, op: DeckOperation, db: DB, seqNo: number) {
	await db
		.insert(schema.decks)
		.values({
			id: op.payload.id,
			name: op.payload.name,
			description: op.payload.description,
			deleted: op.payload.deleted,
			lastModified: new Date(op.timestamp),
			lastModifiedClient: op.clientId,
			seqNo,
			userId,
		})
		.onConflictDoUpdate({
			target: schema.decks.id,
			set: {
				name: op.payload.name,
				description: op.payload.description,
				deleted: op.payload.deleted,
				lastModified: new Date(op.timestamp),
				lastModifiedClient: op.clientId,
			},
			setWhere: sql`
		excluded.last_modified > ${schema.decks.lastModified}
		OR (excluded.last_modified = ${schema.decks.lastModified}
			AND excluded.last_modified_client > ${schema.decks.lastModifiedClient})
		`,
		});
}

export async function handleOperation(userId: string, op: Operation, db: D1Database) {
	const seqNo = await reserveSeqNo(userId, db, 1);
	const drizzleDb = drizzle(db, {
		schema,
	});

	switch (op.type) {
		case 'card':
			return handleCardOperation(userId, op, drizzleDb, seqNo);
		case 'cardContent':
			return handleCardContentOperation(op, drizzleDb, seqNo);
		case 'cardDeleted':
			return handleCardDeletedOperation(op, drizzleDb, seqNo);
		case 'deck':
			return handleDeckOperation(userId, op, drizzleDb, seqNo);
		default:
			const _exhaustiveCheck: never = op;
			throw new Error(`Unknown operation type: ${JSON.stringify(op)}`);
	}
}
