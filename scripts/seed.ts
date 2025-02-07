import Database from 'better-sqlite3';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFile } from 'fs/promises';
import { promisify } from 'util';
import {
	ClientToServer,
	operationToBatchItem,
	opToClient2ServerOp
} from '../src/client2server';
import * as schema from '../src/db/schema';
import { Operation, operationSchema } from '../src/operation';
import { schemaString } from '../test/integration/sql';

dotenv.config({ path: './scripts/.env.old' });

const MIGRATION_CLIENT_ID = '__spaced-migration-client_';
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

	const userAccounts = JSON.parse(await readFile(process.env.ACCOUNTS_PATH!, 'utf-8'));
	type ReadUserAccount = {
		email: string;
		providerAccountId: string;
		provider: string;
		imageUrl: string;
		displayName: string;
		userId: string;
	};

	await db.insert(schema.users).values(
		userAccounts.map((account: ReadUserAccount) => ({
			id: account.userId,
			email: account.email,
			imageUrl: account.imageUrl,
			displayName: account.displayName,
		}))
	);

	await db.insert(schema.oauthAccounts).values(
		userAccounts.map((account: ReadUserAccount) => ({
			id: crypto.randomUUID(),
			providerUserId: account.providerAccountId,
			provider: account.provider,
			userId: account.userId,
		}))
	);

	await db.insert(schema.clients).values(
		userAccounts.map((account: ReadUserAccount) => ({
			id: MIGRATION_CLIENT_ID + account.userId,
			userId: account.userId,
		}))
	);

	// partition the operations by user
	const operations: ClientToServer<Operation>[] = JSON.parse(
		await readFile(process.env.OUTPUT_PATH!, 'utf-8')
	);

	const dateParsedOperations = operations.map((op, i) => {
		const parsed = operationSchema.parse(op);
		const originalOp = operations[i];

		return {
			...parsed,
			userId: originalOp.userId,
			clientId: originalOp.clientId,
		};
	});

	const operationsByUser = dateParsedOperations.reduce((acc, op) => {
		acc[op.userId] = [...(acc[op.userId] || []), op];
		return acc;
	}, {} as Record<string, ClientToServer<Operation>[]>);

	for (const [userId, ops] of Object.entries(operationsByUser)) {
		const clientOps = ops.map((op) => opToClient2ServerOp(op, userId, op.clientId));

		const updatedSeqNo = clientOps.length + 1;
		await db
			.update(schema.users)
			.set({ nextSeqNo: updatedSeqNo })
			.where(eq(schema.users.id, userId));

		// No batch api for sqlite3
		const batchItems = clientOps.map((op, i) => operationToBatchItem(op, db, i + 1));
		for (let i = 0; i < batchItems.length; i++) {
			await batchItems[i];
		}
	}

	console.log('Backup started');
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
