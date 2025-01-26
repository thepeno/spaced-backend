import { SELF } from 'cloudflare:test';
import { createTestUser, loginTestUser } from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';

let cookie: string;
beforeEach(async () => {
	await createTestUser();
	const { cookie: cookieFromLogin } = await loginTestUser();
	cookie = cookieFromLogin;
});

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
