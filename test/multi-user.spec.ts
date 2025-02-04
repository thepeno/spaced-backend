import { CardOperation, Operation } from '@/operation';
import { ServerToClient } from '@/server2client';
import { SELF } from 'cloudflare:test';
import {
	createTestCardsTestUser1,
	createTestUsers,
	DEFAULT_CARD_VARS,
	loginTestUser,
	testClientId,
	testUser2ClientId,
	testUser2Credentials,
} from 'test/integration/utils';
import { SyncResponseGET, SyncResponsePOST } from 'test/sync.types';
import { beforeEach, describe, expect, it } from 'vitest';

const now = 10000;
let cookie1: string;
let cookie2: string;

beforeEach(async () => {
	await createTestUsers();
	await createTestCardsTestUser1();
	const { cookie: cookieFromLogin1 } = await loginTestUser();
	cookie1 = cookieFromLogin1;
	const { cookie: cookieFromLogin2 } = await loginTestUser(testUser2Credentials);
	cookie2 = cookieFromLogin2;
});

const cardOp1: Operation = {
	type: 'card',
	timestamp: now,
	payload: {
		id: 'test-2-card-1',
		...DEFAULT_CARD_VARS,
	},
};

describe('multi-user', () => {
	it('should not be able to sync with a different user', async () => {
		const response = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie2,
				'X-Client-Id': testUser2ClientId,
			},
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponseGET = await response.json();
		expect(syncResponse.ops).toMatchObject([]);
	});

	it('should sync with separate seq no', async () => {
		const response = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie2,
				'X-Client-Id': testUser2ClientId,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ops: [cardOp1] }),
		});

		expect(response.status).toBe(200);
		const syncResponse: SyncResponsePOST = await response.json();
		expect(syncResponse.success).toBe(true);

		const response2 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie2,
				'X-Client-Id': 'another-client-id',
			},
		});

		expect(response2.status).toBe(200);
		const syncResponse2: SyncResponseGET = await response2.json();
		expect(syncResponse2.ops).toMatchObject([
			{
				...cardOp1,
				payload: {
					...cardOp1.payload,
					due: cardOp1.payload.due.toISOString(),
				},
				seqNo: 1,
			},
		]);
	});

	it('should handle concurrent fetch requests', async () => {
		const [response1, response2] = await Promise.all([
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				headers: {
					Cookie: cookie1,
					'X-Client-Id': 'another-client-id-1',
				},
			}),
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				headers: {
					Cookie: cookie2,
					'X-Client-Id': 'another-client-id-2',
				},
			}),
		]);

		const syncResponse1: SyncResponseGET = await response1.json();
		const syncResponse2: SyncResponseGET = await response2.json();

		expect(syncResponse1.ops).toHaveLength(2);
		expect(syncResponse2.ops).toMatchObject([]);
	});

	it('should handle concurrent POST requests', async () => {
		const [response1, response2] = await Promise.all([
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				method: 'POST',
				headers: {
					Cookie: cookie1,
					'X-Client-Id': testClientId,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					ops: [
						{
							...cardOp1,
							payload: {
								...cardOp1.payload,
								id: 'test-1-card-1',
							},
						},
					],
				}),
			}),
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				method: 'POST',
				headers: {
					Cookie: cookie2,
					'X-Client-Id': testUser2ClientId,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					ops: [cardOp1],
				}),
			}),
		]);

		const syncResponse1: SyncResponsePOST = await response1.json();
		const syncResponse2: SyncResponsePOST = await response2.json();

		expect(response1.status).toBe(200);
		expect(response2.status).toBe(200);
		expect(syncResponse1.success).toBe(true);
		expect(syncResponse2.success).toBe(true);

		const [get1, get2] = await Promise.all([
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				headers: {
					Cookie: cookie1,
					'X-Client-Id': 'another-client-id-1',
				},
			}),
			SELF.fetch('https://example.com/api/sync?seqNo=0', {
				headers: {
					Cookie: cookie2,
					'X-Client-Id': 'another-client-id-2',
				},
			}),
		]);

		const getResponse1: SyncResponseGET = await get1.json();
		const getResponse2: SyncResponseGET = await get2.json();

		expect(getResponse1.ops).toHaveLength(3);
		expect(getResponse2.ops).toHaveLength(1);

		const newOp1 = getResponse1.ops[2] as ServerToClient<CardOperation>;
		expect(newOp1.payload.id).toBe('test-1-card-1');

		const newOp2 = getResponse2.ops[0] as ServerToClient<CardOperation>;
		expect(newOp2.payload.id).toBe(cardOp1.payload.id);
	});

	it('reusing same cardId by multiple users should not cause problems', async () => {
		const response1 = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie1,
				'X-Client-Id': testClientId,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				ops: [cardOp1],
			}),
		});

		expect(response1.status).toBe(200);
		const syncResponse1: SyncResponsePOST = await response1.json();
		expect(syncResponse1.success).toBe(true);

		const response2 = await SELF.fetch('https://example.com/api/sync', {
			method: 'POST',
			headers: {
				Cookie: cookie2,
				'X-Client-Id': testUser2ClientId,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				ops: [cardOp1],
			}),
		});

		expect(response2.status).toBe(200);
		const syncResponse2: SyncResponsePOST = await response2.json();
		expect(syncResponse2.success).toBe(true);
		// User 2 syncs from another client
		const response3 = await SELF.fetch('https://example.com/api/sync?seqNo=0', {
			headers: {
				Cookie: cookie2,
				'X-Client-Id': 'another-client-id-2',
			},
		});

		expect(response3.status).toBe(200);
		const syncResponse3: SyncResponseGET = await response3.json();
		expect(syncResponse3.ops).toHaveLength(1);

		expect(syncResponse3.ops).toMatchObject([
			{
				...cardOp1,
				payload: {
					...cardOp1.payload,
					due: cardOp1.payload.due.toISOString(),
				},
			},
		]);
	});
});
