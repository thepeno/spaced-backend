import Database from 'better-sqlite3';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import { z } from 'zod';
import {
	handleCardBookmarkedOperation,
	handleCardContentOperation,
	handleCardDeletedOperation,
	handleCardOperation,
	handleCardSuspendedOperation,
	handleDeckOperation,
	handleReviewLogDeletedOperation,
	handleReviewLogOperation,
	handleUpdateDeckCardOperation,
	opToClient2ServerOp,
} from '../src/client2server';
import * as schema from '../src/db/schema';
import { Operation, operationSchema } from '../src/operation';
import { schemaString } from '../test/integration/sql';

dotenv.config({ path: './scripts/.env.old' });

const sqlite = new Database(':memory:');
const db = drizzle(sqlite, {
	schema,
});

function createTables() {
	console.log('Creating tables...');
	const statements = schemaString.split(';').filter((s) => s.trim().length > 0);
	for (const statement of statements) {
		db.$client.exec(statement);
	}
	console.log('Tables created');
}

async function main() {
	createTables();

	await db.insert(schema.users).values([
		{
			id: 'test-1',
			email: 'test@email.com',
			passwordHash: 'Xj+SO0CHAnpDOZyhr2+KAmz1n60hDmogm+9UkmLi4p0K78+RyxWVbqT0u/TsIOBP',
		},
		{
			id: 'test-2',
			email: 'test2@email.com',
			passwordHash: 'Xj+SO0CHAnpDOZyhr2+KAmz1n60hDmogm+9UkmLi4p0K78+RyxWVbqT0u/TsIOBP',
		},
	]);

	await db.insert(schema.clients).values([
		{
			id: 'test-client-1',
			userId: 'test-1',
		},
	]);

	const operations: Operation[] = z
		.array(operationSchema)
		.parse(JSON.parse(await readFile(process.env.OUTPUT_PATH!, 'utf-8')));
	const clientOps = operations.map((op) => opToClient2ServerOp(op, 'test-1', 'test-client-1'));

	const updatedSeqNo = clientOps.length + 1;
	await db
		.update(schema.users)
		.set({ nextSeqNo: updatedSeqNo })
		.where(eq(schema.users.id, 'test-1'));

	for (let i = 1; i <= clientOps.length; i++) {
		const seqNo = i;
		const operation = clientOps[i - 1];

		switch (operation.type) {
			case 'card':
				await handleCardOperation(operation, db, seqNo);
				break;
			case 'cardContent':
				await handleCardContentOperation(operation, db, seqNo);
				break;
			case 'cardDeleted':
				await handleCardDeletedOperation(operation, db, seqNo);
				break;
			case 'deck':
				await handleDeckOperation(operation, db, seqNo);
				break;
			case 'updateDeckCard':
				await handleUpdateDeckCardOperation(operation, db, seqNo);
				break;
			case 'cardSuspended':
				await handleCardSuspendedOperation(operation, db, seqNo);
				break;
			case 'cardBookmarked':
				await handleCardBookmarkedOperation(operation, db, seqNo);
				break;
			case 'reviewLog':
				await handleReviewLogOperation(operation, db, seqNo);
				break;
			case 'reviewLogDeleted':
				await handleReviewLogDeletedOperation(operation, db, seqNo);
				break;
			default:
				throw new Error(`Unknown operation type: ${JSON.stringify(operation)}`);
		}
	}

	console.log('Backup started');
	// await sqlite.backup(process.env.OUTPUT_DB!);

	await sqlite.backup(process.env.OUTPUT_DB!);

	const execAsync = promisify(exec);
	await execAsync(
		`sqlite3 ${process.env.OUTPUT_DB!} ".output temp.sql" ".schema" ".dump --data-only"`
	);

	// It's necessary to temporarily disable foreign key constraints when executing against D1
	// because D1 runs each statement in a transaction
	// https://developers.cloudflare.com/d1/best-practices/import-export-data/#foreign-key-constraints
	await execAsync(`echo "PRAGMA defer_foreign_keys = true;" > ${process.env.OUTPUT_DUMP}`);
	await execAsync(`cat temp.sql >> ${process.env.OUTPUT_DUMP}`);

	await execAsync(`rm temp.sql`);
	await execAsync(`rm ${process.env.OUTPUT_DB!}`);

	console.log('Backup completed');
}

main();
