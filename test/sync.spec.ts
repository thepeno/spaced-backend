import { TOO_MANY_OPS_ERROR_MSG, ValidateOpCountResult } from '@/client2server';
import { Operation } from '@/operation';
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
		const response = await SELF.fetch('http://localhost:3000/clientId', {
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
		const response = await SELF.fetch('https://example.com/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId,
			},
		});
		const syncResponse: SyncResponseGET = await response.json();
		expect(response.status).toBe(200);
		expect(syncResponse.ops).toMatchObject([]);
	});

	it.only('can sync a single card', async () => {
		const response = await SELF.fetch('https://example.com/sync', {
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
		const response = await SELF.fetch('https://example.com/sync?seqNo=0', {
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

		const response2 = await SELF.fetch('https://example.com/sync?seqNo=0', {
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
		const response = await SELF.fetch('https://example.com/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		const syncResponse: SyncResponseGET = await response.json();
		expect(syncResponse.ops).toMatchObject([]);

		// client 1 syncs a card
		const response2 = await SELF.fetch('https://example.com/sync?seqNo=0', {
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
		const response3 = await SELF.fetch('https://example.com/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		expect(response3.status).toBe(200);
		const syncResponse3: SyncResponseGET = await response3.json();
		expect(syncResponse3.ops).toMatchObject([
			{
				...cardOp1,
				seqNo: 1,
			},
		]);
	});

	it('can sync multiple cards that different client can read', async () => {
		const response = await SELF.fetch('https://example.com/sync', {
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

		const response2 = await SELF.fetch('https://example.com/sync?seqNo=0', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});

		// Only the latest operations are returned
		const syncResponse2: SyncResponseGET = await response2.json();
		expect(syncResponse2.ops).toMatchObject([
			{ ...cardOp2, seqNo: 2 },
			{ ...cardOp3, seqNo: 3 },
		]);
	});

	it('skips sequence number based on query param', async () => {
		const response = await SELF.fetch('https://example.com/sync', {
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

		const response2 = await SELF.fetch('https://example.com/sync?seqNo=2', {
			headers: {
				Cookie: cookie,
				'X-Client-Id': testClientId2,
			},
		});
		const syncResponse2: SyncResponseGET = await response2.json();
		expect(syncResponse2.ops).toMatchObject([{ ...cardOp3, seqNo: 3 }]);
	});

	it('returns an error if too many operations are sent', async () => {
		const response = await SELF.fetch('https://example.com/sync', {
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
