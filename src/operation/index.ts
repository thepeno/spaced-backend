import { Card } from '@/db/schema';

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

export async function handleCardOperation(userId: string, op: CardOperation, db: D1Database, seqNo: number) {
	// Drizzle's transactions are not supported in D1
	// https://github.com/drizzle-team/drizzle-orm/issues/2463
	// Sqlite is also limited in its upsert capabilities
	// we must use transactions for Cloudflare D1

	// Update also cannot be in the CTE section
	const stmt = db.prepare(`
  INSERT INTO cards (last_modified, last_modified_client, seq_no, id, user_id)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id)
  DO UPDATE SET
    -- assuming op.payload fields here
    seq_no = ?,
    last_modified_client = ?,
    last_modified = ?
  WHERE
    excluded.last_modified < ?
    OR (excluded.last_modified = ?
        AND excluded.last_modified_client < ?)
`);

	const timestampSeconds = op.timestamp / 1000;
	await stmt
		.bind(
			timestampSeconds,
			op.clientId,
			seqNo,
			op.payload.id,
			userId,
			seqNo,
			op.clientId,
			timestampSeconds,
			timestampSeconds,
			timestampSeconds,
			op.clientId
		)
		.run();
}

export async function handleOperation(userId: string, op: Operation, db: D1Database) {
	const seqNo = await reserveSeqNo(userId, db, 1);

	switch (op.type) {
		case 'card':
			return handleCardOperation(userId, op, db, seqNo);
		default:
			throw new Error(`Unknown operation type: ${op.type}`);
	}
}
