import { DB } from '@/db';
import * as schema from '@/db/schema';
import { CardContentOperation, CardOperation, handleOperation } from '@/operation';
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

const cardOp1: CardOperation = {
	type: 'card',
	clientId: testClientId,
	timestamp: now,
	payload: {
		id: 'test-card-1',
	},
};

const cardOp2: CardOperation = {
	type: 'card',
	clientId: testClientId,
	timestamp: now + 1000,
	payload: {
		id: 'test-card-1',
	},
};

const cardOp3: CardOperation = {
	type: 'card',
	clientId: testClientId2,
	timestamp: now + 1000,
	payload: {
		id: 'test-card-1',
	},
};

describe('card operations', () => {
	it('should have a user', async () => {
		const user = await db.query.users.findFirst({
			where: eq(schema.users.id, testUser.id),
		});
		expect(user).toBeDefined();
		expect(user!.id).toBe(testUser.id);
	});

	it('should insert a new card', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, cardOp1.payload.id),
		});

		expect(card).toBeDefined();
		expect(card!.id).toBe(cardOp1.payload.id);
		expect(card!.seqNo).toBe(1);
		expect(card!.lastModifiedClient).toBe(cardOp1.clientId);
		expect(Math.abs(card!.lastModified.getTime() - cardOp1.timestamp)).toBeLessThan(1000);

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
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardOp2, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, cardOp1.payload.id),
		});
		expect(card).toBeDefined();
		expect(card!.lastModifiedClient).toBe(cardOp2.clientId);
		expect(Math.abs(card!.lastModified.getTime() - cardOp2.timestamp)).toBeLessThan(1000);
	});

	it('later operation wins even when it comes first', async () => {
		await handleOperation(testUser.id, cardOp2, env.D1);
		await handleOperation(testUser.id, cardOp1, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, cardOp1.payload.id),
		});
		expect(card).toBeDefined();
		expect(card?.seqNo).toBe(1);
		expect(card!.lastModifiedClient).toBe(cardOp2.clientId);
		expect(Math.abs(card!.lastModified.getTime() - cardOp2.timestamp)).toBeLessThan(1000);
	});

	it('when same time, the higher client id wins', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardOp3, env.D1);

		const card = await db.query.cards.findFirst({
			where: eq(schema.cards.id, cardOp1.payload.id),
		});

		expect(card).toBeDefined();
		expect(card!.lastModifiedClient).toBe(cardOp3.clientId);
		expect(Math.abs(card!.lastModified.getTime() - cardOp3.timestamp)).toBeLessThan(1000);
	});
});

describe.only('card content operations', () => {
	const cardContentOp: CardContentOperation = {
		type: 'cardContent',
		clientId: testClientId,
		timestamp: now,
		payload: {
			cardId: 'test-card-1',
			front: 'test-front',
			back: 'test-back',
		},
	};

	const cardContentOp2: CardContentOperation = {
		type: 'cardContent',
		clientId: testClientId,
		timestamp: now + 100000,
		payload: {
			cardId: 'test-card-1',
			front: 'test-front-2',
			back: 'test-back-2',
		},
	};

	const cardContentOp3: CardContentOperation = {
		type: 'cardContent',
		clientId: testClientId2,
		timestamp: now,
		payload: {
			cardId: 'test-card-1',
			front: 'test-front-3',
			back: 'test-back-3',
		},
	};

	it('should insert a new card content', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardContentOp, env.D1);

		const cardContent = await db.query.cardContents.findFirst({
			where: eq(schema.cardContents.cardId, cardContentOp.payload.cardId),
		});

		expect(cardContent).toBeDefined();
		expect(cardContent!.front).toBe(cardContentOp.payload.front);
		expect(cardContent!.back).toBe(cardContentOp.payload.back);
	});

	it('should do nothing if card content comes after card creation', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardContentOp, env.D1);

		const cardContent = await db.query.cardContents.findFirst({
			where: eq(schema.cardContents.cardId, cardContentOp.payload.cardId),
		});

		expect(cardContent).toBeDefined();
		expect(cardContent!.front).toBe(cardContentOp.payload.front);
		expect(cardContent!.back).toBe(cardContentOp.payload.back);
		expect(cardContent!.lastModifiedClient).toBe(cardOp1.clientId);
		expect(Math.abs(cardContent!.lastModified.getTime() - cardOp1.timestamp)).toBeLessThan(1000);
	});

	it('should not change card content if card is updated after card content', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardContentOp, env.D1);
		await handleOperation(testUser.id, cardOp2, env.D1);

		const cardContent = await db.query.cardContents.findFirst({
			where: eq(schema.cardContents.cardId, cardContentOp.payload.cardId),
		});

		expect(cardContent).toBeDefined();
		expect(cardContent!.front).toBe(cardContentOp.payload.front);
		expect(cardContent!.back).toBe(cardContentOp.payload.back);
		expect(cardContent!.lastModifiedClient).toBe(cardOp1.clientId);
		expect(Math.abs(cardContent!.lastModified.getTime() - cardOp1.timestamp)).toBeLessThan(1000);
	});

	it('later operation wins', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardContentOp, env.D1);
		await handleOperation(testUser.id, cardContentOp2, env.D1);

		const cardContent = await db.query.cardContents.findFirst({
			where: eq(schema.cardContents.cardId, cardContentOp.payload.cardId),
		});

		expect(cardContent).toBeDefined();
		expect(cardContent!.front).toBe(cardContentOp2.payload.front);
		expect(cardContent!.back).toBe(cardContentOp2.payload.back);
		expect(cardContent!.lastModifiedClient).toBe(cardContentOp2.clientId);
		expect(Math.abs(cardContent!.lastModified.getTime() - cardContentOp2.timestamp)).toBeLessThan(1000);
	});

	it('when same time, the higher client id wins', async () => {
		await handleOperation(testUser.id, cardOp1, env.D1);
		await handleOperation(testUser.id, cardContentOp, env.D1);
		await handleOperation(testUser.id, cardContentOp3, env.D1);

		const cardContent = await db.query.cardContents.findFirst({
			where: eq(schema.cardContents.cardId, cardContentOp.payload.cardId),
		});

		expect(cardContent).toBeDefined();
		expect(cardContent!.front).toBe(cardContentOp3.payload.front);
		expect(cardContent!.back).toBe(cardContentOp3.payload.back);
		expect(cardContent!.lastModifiedClient).toBe(cardContentOp3.clientId);
		expect(Math.abs(cardContent!.lastModified.getTime() - cardContentOp3.timestamp)).toBeLessThan(1000);
	});
});
