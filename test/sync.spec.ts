import { TOO_MANY_OPS_ERROR_MSG, ValidateOpCountResult } from '@/client2server';
import { CardOperation, Operation } from '@/operation';
import { ServerToClient } from '@/server2client';
import { SELF } from 'cloudflare:test';
import {
	createTestUsers,
	DEFAULT_CARD_VARS,
	loginTestUser,
	testClientId,
	testClientId2,
} from 'test/integration/utils';
import { type SyncResponseGET, type SyncResponsePOST } from 'test/sync.types';
import { beforeEach, describe, expect, it } from 'vitest';

let cookie: string;
beforeEach(async () => {
	await createTestUsers();
	const { cookie: cookieFromLogin } = await loginTestUser();
	cookie = cookieFromLogin;
});

// Use a timestamp that rounds to 1000 for simplicity
const now = 10000;

const cardOp1: Operation = {
	type: 'card',
	timestamp: now,
	payload: {
		id: 'test-card-1',
		...DEFAULT_CARD_VARS,
	},
};

const cardOp2: Operation = {
	type: 'card',
	timestamp: now + 100000,
	payload: {
		id: 'test-card-1',
		...DEFAULT_CARD_VARS,
	},
};

const cardOp3: Operation = {
	type: 'card',
	timestamp: now + 100000,
	payload: {
		id: 'test-card-2',
		...DEFAULT_CARD_VARS,
	},
};

describe('clientId', () => {
	it('returns a clientId', async () => {
		const response = await SELF.fetch('http://localhost:3000/api/auth/clientId', {
			headers: {
				Cookie: cookie,
			},
			method: 'POST',
		});

		expect(response.status).toBe(201);
		const clientId: { clientId: string } = await response.json();
		expect(clientId).toBeDefined();
		expect(clientId.clientId).toBeDefined();
		expect(clientId.clientId).toHaveLength(16);
	});
});

describe('sync', () => {
	it('returns an empty array if no operations are present', async () => {
		const response = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId,
			},
		});
		const syncResponse: SyncResponseGET = await response.json();
		expect(response.status).toBe(200);
		expect(syncResponse.ops).toMatchObject([]);
	});

	it('can sync a single card', async () => {
		const response = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/json',
				'X-Client-Id': testClientId,
			},
			body: JSON.stringify({ ops: [cardOp1] }),
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponsePOST = await response.json();
		expect(syncResponse.success).toBe(true);
	});

	it('same client reads back empty array after syncing a single card', async () => {
		const response = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId,
				'Content-Type': 'application/json',
			},
			method: 'POST',
			body: JSON.stringify({ ops: [cardOp1] }),
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponsePOST = await response.json();
		expect(syncResponse.success).toBe(true);

		const response2 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId,
			},
		});
		const syncResponse2: SyncResponseGET = await response2.json();
		expect(syncResponse2.ops).toMatchObject([]);
	});

	it('can sync a single card that different client can read', async () => {
		// client 2 reads empty array
		const response = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		const syncResponse: SyncResponseGET = await response.json();
		expect(syncResponse.ops).toMatchObject([]);

		// client 1 syncs a card
		const response2 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId,
				'Content-Type': 'application/json',
			},
			method: 'POST',
			body: JSON.stringify({ ops: [cardOp1] }),
		});
		expect(response2.status).toBe(200);
		const syncResponse2: SyncResponsePOST = await response2.json();
		expect(syncResponse2.success).toBe(true);

		// client 2 reads the card
		const response3 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		expect(response3.status).toBe(200);
		const syncResponse3: SyncResponseGET = await response3.json();
		expect(syncResponse3.ops).toHaveLength(1);
		const op = syncResponse3.ops[0] as ServerToClient<CardOperation>;
		expect(op.seqNo).toBe(1);
		expect(op.type).toBe(cardOp1.type);
		expect(op.payload.id).toBe(cardOp1.payload.id);
		expect(op.payload.state).toBe(cardOp1.payload.state);
		expect(op.payload.stability).toBe(cardOp1.payload.stability);
		expect(op.payload.difficulty).toBe(cardOp1.payload.difficulty);
		expect(op.payload.elapsed_days).toBe(cardOp1.payload.elapsed_days);
		expect(op.payload.scheduled_days).toBe(cardOp1.payload.scheduled_days);
		expect(op.payload.reps).toBe(cardOp1.payload.reps);
		expect(op.payload.lapses).toBe(cardOp1.payload.lapses);
	});

	it('can sync multiple cards that different client can read', async () => {
		const response = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/json',
				'X-Client-Id': testClientId,
			},
			body: JSON.stringify({ ops: [cardOp1, cardOp2, cardOp3] }),
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponsePOST = await response.json();
		expect(syncResponse.success).toBe(true);

		const response2 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});

		// Only the latest operations are returned
		const syncResponse2: SyncResponseGET = await response2.json();
		expect(syncResponse2.ops).toHaveLength(2);
		const op2 = syncResponse2.ops[0] as ServerToClient<CardOperation>;
		expect(op2.seqNo).toBe(2);
		expect(op2.type).toBe(cardOp2.type);
		expect(op2.payload.id).toBe(cardOp2.payload.id);
		expect(op2.payload.state).toBe(cardOp2.payload.state);
		expect(op2.payload.stability).toBe(cardOp2.payload.stability);
		expect(op2.payload.difficulty).toBe(cardOp2.payload.difficulty);
		expect(op2.payload.elapsed_days).toBe(cardOp2.payload.elapsed_days);
		expect(op2.payload.scheduled_days).toBe(cardOp2.payload.scheduled_days);
		expect(op2.payload.reps).toBe(cardOp2.payload.reps);
		expect(op2.payload.lapses).toBe(cardOp2.payload.lapses);

		const op3 = syncResponse2.ops[1] as ServerToClient<CardOperation>;
		expect(op3.seqNo).toBe(3);
		expect(op3.type).toBe(cardOp3.type);
		expect(op3.payload.id).toBe(cardOp3.payload.id);
		expect(op3.payload.state).toBe(cardOp3.payload.state);
	});

	it('skips sequence number based on query param', async () => {
		const response = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/json',
				'X-Client-Id': testClientId,
			},
			body: JSON.stringify({ ops: [cardOp1, cardOp2, cardOp3] }),
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponsePOST = await response.json();
		expect(syncResponse.success).toBe(true);

		const response2 = await SELF.fetch('https://example.com/api/sync?seqNo=2', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		const syncResponse2: SyncResponseGET = await response2.json();

		expect(syncResponse2.ops).toHaveLength(1);
		const op = syncResponse2.ops[0] as ServerToClient<CardOperation>;
		expect(op.seqNo).toBe(3);
		expect(op.type).toBe(cardOp3.type);
		expect(op.payload.id).toBe(cardOp3.payload.id);
		expect(op.payload.state).toBe(cardOp3.payload.state);
		expect(op.payload.stability).toBe(cardOp3.payload.stability);
		expect(op.payload.difficulty).toBe(cardOp3.payload.difficulty);
		expect(op.payload.elapsed_days).toBe(cardOp3.payload.elapsed_days);
		expect(op.payload.scheduled_days).toBe(cardOp3.payload.scheduled_days);
		expect(op.payload.reps).toBe(cardOp3.payload.reps);
		expect(op.payload.lapses).toBe(cardOp3.payload.lapses);
	});

	it('returns an error if too many operations are sent', async () => {
		const response = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/json',
				'X-Client-Id': testClientId,
			},
			body: JSON.stringify({ ops: Array.from({ length: 10001 }, () => cardOp1) }),
		});

		expect(response.status).toBe(413);
		const syncResponse: ValidateOpCountResult = await response.json();
		expect(syncResponse.success).toBe(false);
		if (syncResponse.success) {
			throw new Error('Test failed');
		}
		expect(syncResponse.error).toBe(TOO_MANY_OPS_ERROR_MSG);
	});
});
