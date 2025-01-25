import { DB } from '@/db';
import * as schema from '@/db/schema';
import { CardOperation, handleOperation } from '@/operation';
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

describe('card operations', () => {
	const op1: CardOperation = {
		type: 'card',
		clientId: testClientId,
		timestamp: Date.now(),
		payload: {
			id: 'test-card-1',
		},
	};

	const op2: CardOperation = {
		type: 'card',
		clientId: testClientId,
		timestamp: Date.now() + 1000,
		payload: {
			id: 'test-card-1',
		},
	};

	const op3: CardOperation = {
		type: 'card',
		clientId: testClientId2,
		timestamp: Date.now(),
		payload: {
			id: 'test-card-1',
		},
	};

	it('should have a user', async () => {
		const user = await db.query.users.findFirst({
			where: eq(schema.users.id, testUser.id),
		});
		expect(user).toBeDefined();
		expect(user!.id).toBe(testUser.id);
	})

	it('should insert a new card', async () => {
		await handleOperation(testUser.id, op1, env.D1);
		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, op1.payload.id),
		});

		expect(card).toBeDefined();
		expect(card!.id).toBe(op1.payload.id);
		expect(card!.seqNo).toBe(1);
		expect(card!.lastModifiedClient).toBe(op1.clientId);
		expect(Math.abs(card!.lastModified.getTime() - op1.timestamp)).toBeLessThan(1000);

		const user = await db.query.users.findFirst({
			where: eq(schema.users.id, testUser.id),
			columns: {
				nextSeqNo: true,
			},
		});
		expect(user).toBeDefined();
		expect(user!.nextSeqNo).toBe(2);
	});

	it('later operation wins', async () => {
		await handleOperation(testUser.id, op1, env.D1);
		await handleOperation(testUser.id, op2, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, op1.payload.id),
		});
		expect(card).toBeDefined();
		expect(card!.lastModifiedClient).toBe(op2.clientId);
		expect(Math.abs(card!.lastModified.getTime() - op2.timestamp)).toBeLessThan(1000);
	});

	it('later operation wins even when it comes first', async () => {
		await handleOperation(testUser.id, op2, env.D1);
		await handleOperation(testUser.id, op1, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, op1.payload.id),
		});
		expect(card).toBeDefined();
		expect(card?.seqNo).toBe(1);
		expect(card!.lastModifiedClient).toBe(op2.clientId);
		expect(Math.abs(card!.lastModified.getTime() - op2.timestamp)).toBeLessThan(1000);
	});

	it('when same time, the higher client id wins', async () => {
		await handleOperation(testUser.id, op1, env.D1);
		await handleOperation(testUser.id, op3, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, op1.payload.id),
		});

		expect(card).toBeDefined();
		expect(card!.lastModifiedClient).toBe(op3.clientId);
		expect(Math.abs(card!.lastModified.getTime() - op3.timestamp)).toBeLessThan(1000);
	});

});
