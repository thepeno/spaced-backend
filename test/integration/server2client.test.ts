import { DB } from '@/db';
import * as schema from '@/db/schema';
import {
	CardContentOperation,
	CardDeletedOperation,
	CardOperation,
	ClientToServer,
	handleClientOperation,
	ServerToClient,
} from '@/client2server';
import { getAllOpsFromSeqNoExclClient } from '@/server2client';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { createTestUser, testClientId, testClientId2, testUser } from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';

let db: DB;
beforeEach(async () => {
	await createTestUser();
	db = drizzle(env.D1, {
		schema,
	});
});

const now = Date.now();

const cardOp1: ClientToServer<CardOperation> = {
	type: 'card',
	userId: testUser.id,
	clientId: testClientId,
	timestamp: now,
	payload: {
		id: 'test-card-1',
	},
};

const cardContentOp1: ClientToServer<CardContentOperation> = {
	type: 'cardContent',
	userId: testUser.id,
	clientId: testClientId,
	timestamp: now,
	payload: {
		cardId: 'test-card-1',
		front: 'test-front-1',
		back: 'test-back-1',
	},
};

const cardContentOp2FromClient2: ClientToServer<CardContentOperation> = {
	type: 'cardContent',
	userId: testUser.id,
	clientId: testClientId2,
	timestamp: now + 10000,
	payload: {
		cardId: 'test-card-1',
		front: 'test-front-2',
		back: 'test-back-2',
	},
};

const cardDeletedOp1: ClientToServer<CardDeletedOperation> = {
	type: 'cardDeleted',
	userId: testUser.id,
	clientId: testClientId,
	timestamp: now,
	payload: {
		cardId: 'test-card-1',
		deleted: false,
	},
};

async function addCard() {
	await handleClientOperation(cardOp1, env.D1);
	await handleClientOperation(cardContentOp1, env.D1);
	await handleClientOperation(cardDeletedOp1, env.D1);
}

describe('server2client', () => {
	it('should return empty array if no operations', async () => {
		const operations = await getAllOpsFromSeqNoExclClient(db, 'not-the-client', 0);
		expect(operations).toHaveLength(0);
	});

	it('should return empty array if request operations from same client', async () => {
		await handleClientOperation(cardOp1, env.D1);

		const operations = await getAllOpsFromSeqNoExclClient(db, testClientId, 0);
		expect(operations).toHaveLength(0);
	});

	it('should return operations if different client requesting', async () => {
		await addCard();
		const operations = await getAllOpsFromSeqNoExclClient(db, 'not-the-client', 0);

		expect(operations).toHaveLength(3);
		const cardOperation = operations[0] as ServerToClient<CardOperation>;
		const cardContentOperation = operations[1] as ServerToClient<CardContentOperation>;
		const cardDeletedOperation = operations[2] as ServerToClient<CardDeletedOperation>;

		expect(cardOperation.type).toBe('card');
		expect(cardOperation.payload.id).toBe('test-card-1');
		expect(cardOperation.seqNo).toBe(1);

		expect(cardContentOperation.type).toBe('cardContent');
		expect(cardContentOperation.payload.cardId).toBe('test-card-1');
		expect(cardContentOperation.seqNo).toBe(2);

		expect(cardDeletedOperation.type).toBe('cardDeleted');
		expect(cardDeletedOperation.payload.cardId).toBe('test-card-1');
		expect(cardDeletedOperation.seqNo).toBe(3);
	});

	it('should return empty array if after greatest seqNo', async () => {
		await addCard();
		const result = await db.query.users.findFirst({
			where: eq(schema.users.id, testUser.id),
			columns: {
				nextSeqNo: true,
			},
		});

		if (!result) {
			throw new Error('Failed to get nextSeqNo');
		}
		const nextSeqNo = result.nextSeqNo;

		const operations = await getAllOpsFromSeqNoExclClient(db, 'not-the-client', nextSeqNo);
		expect(operations).toHaveLength(0);
	});

	it('should return latest operations in order of seqNo', async () => {
		await addCard();
		await handleClientOperation(cardContentOp2FromClient2, env.D1);

		const operations = await getAllOpsFromSeqNoExclClient(db, 'not-the-client', 0);

		expect(operations).toHaveLength(3);

		const cardOperation = operations[0] as ServerToClient<CardOperation>;
		const cardDeletedOperation = operations[1] as ServerToClient<CardDeletedOperation>;
		const cardContentOperation = operations[2] as ServerToClient<CardContentOperation>;

		expect(cardOperation.payload.id).toBe('test-card-1');
		expect(cardOperation.seqNo).toBe(1);

		expect(cardDeletedOperation.type).toBe('cardDeleted');
		expect(cardDeletedOperation.payload.deleted).toBe(false);
		expect(cardDeletedOperation.seqNo).toBe(3);

		expect(cardContentOperation.payload.front).toBe('test-front-2');
		expect(cardContentOperation.payload.back).toBe('test-back-2');
		expect(cardContentOperation.seqNo).toBe(4);
	});

	it('should skip some operations if they are from the same client', async () => {
		await addCard();
		await handleClientOperation(cardContentOp2FromClient2, env.D1);

		const operations = await getAllOpsFromSeqNoExclClient(db, testClientId2, 0);
		expect(operations).toHaveLength(2);

		const cardOperation = operations[0] as ServerToClient<CardOperation>;
		const cardDeletedOperation = operations[1] as ServerToClient<CardDeletedOperation>;

		expect(cardOperation.payload.id).toBe('test-card-1');
		expect(cardOperation.seqNo).toBe(1);

		expect(cardDeletedOperation.type).toBe('cardDeleted');
		expect(cardDeletedOperation.payload.deleted).toBe(false);
		expect(cardDeletedOperation.seqNo).toBe(3);
	});
});

