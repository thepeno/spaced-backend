import { Card } from '@/db/schema';

type StripMetadata<T> = Omit<T, 'seqNo' | 'lastModifiedClient' | 'userId' | 'lastModified'>;

export type CardOperation = {
	type: 'card';
	payload: StripMetadata<Card>;
	timestamp: number;
	clientId: string;
};

export type Operation = CardOperation;

export async function handleCardOperation(userId: string, op: CardOperation, db: D1Database) {
	// Drizzle's transactions are not supported in D1
	// https://github.com/drizzle-team/drizzle-orm/issues/2463
	// Sqlite is also limited in its upsert capabilities
	// we must use transactions for Cloudflare D1
	const stmt = db.prepare(`
  WITH next_seq AS (
    SELECT next_seq_no
    FROM users
    WHERE id = ?
  )
  INSERT INTO cards (last_modified, last_modified_client, seq_no, id, user_id)
  VALUES (?, ?, (SELECT next_seq_no FROM next_seq), ?, ?)
  ON CONFLICT(id)
  DO UPDATE SET
    -- assuming op.payload fields here
    seq_no = (SELECT next_seq_no FROM next_seq),
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
			userId, // first ? - users WHERE

			// Insert
			timestampSeconds, // second ? - lastModified
			op.clientId, // fourth ? - lastModifiedClient SET
			op.payload.id, // fifth ? - id WHERE
			userId,

			// Update
			op.clientId, // third ? - lastModifiedClient SET
			timestampSeconds, // fifth ? - lastModified SET

			timestampSeconds, // sixth ? - lastModified comparison
			timestampSeconds, // seventh ? - lastModified comparison
			op.clientId // eighth ? - clientId comparison
		)
		.run();

	const stmt2 = db.prepare(`
			UPDATE users
			SET next_seq_no = next_seq_no + 1
			WHERE id = ?
		`);

	await stmt2.bind(userId).run();
}

export async function handleOperation(userId: string, op: Operation, db: D1Database) {
	switch (op.type) {
		case 'card':
			return handleCardOperation(userId, op, db);
		default:
			throw new Error(`Unknown operation type: ${op.type}`);
	}
}
