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

export type Operation = CardOperation;

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

export async function handleOperation(userId: string, op: Operation, db: D1Database) {
	const seqNo = await reserveSeqNo(userId, db, 1);
	const drizzleDb = drizzle(db, {
		schema,
	});

	switch (op.type) {
		case 'card':
			return handleCardOperation(userId, op, drizzleDb, seqNo);
		default:
			throw new Error(`Unknown operation type: ${op.type}`);
	}
}
