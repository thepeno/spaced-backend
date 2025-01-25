// test/index.spec.ts
import { USER_ALREADY_EXISTS_ERROR_MSG } from '@/auth';
import * as schema from '@/db/schema';
import { CardOperation } from '@/operation';
import { env, SELF } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { createTestUser, testUserEmail, testUserPassword } from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

beforeEach(async () => {
	await createTestUser();
});

const now = Date.now();

const cardOp1: CardOperation = {
	type: 'card',
	timestamp: now,
	payload: {
		id: 'test-card-1',
	},
};

describe('basic', () => {
	it('responds with OK (integration style)', async () => {
		const response = await SELF.fetch('http://localhost:3000/');
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});

	// describe('GET /sync', () => {
	// 	it('returns an empty array if no operations are present', async () => {
	// 		const response = await SELF.fetch('https://example.com/sync?seqNo=0');
	// 		expect(await response.json()).toMatchObject({
	// 			ops: [],
	// 		});
	// 	});

	// 	it.todo('returns an op if different client has made an op', async () => {
	// 		const response = await SELF.fetch('https://example.com/sync?seqNo=0');
	// 		expect(await response.json()).toMatchObject({
	// 			ops: [],
	// 		});
	// 	});

	// 	it.todo('returns an empty array if same client request ops')
	// });

	// it('can sync a single card', async () => {
	// 	const response = await SELF.fetch('https://example.com');
	// 	expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	// });
});

describe('auth', () => {
	describe('register', () => {
		it('can register a user', async () => {
			const response = await SELF.fetch('http://localhost:3000/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: true,
			});
		});

		it('returns error if user already exists', async () => {
			const response = await SELF.fetch('http://localhost:3000/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: USER_ALREADY_EXISTS_ERROR_MSG,
			});
		});

		it('sets a cookie if registration is successful', async () => {
			const response = await SELF.fetch('http://localhost:3000/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
			});

			expect(response.status).toBe(200);
			expect(response.headers.get('Set-Cookie')).toContain('sid');
			expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
			expect(response.headers.get('Set-Cookie')).toContain('Secure');

			const sid = response.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sid).toBeTruthy();
		});
	});

	describe('login', () => {
		it('can login a user', async () => {
			const response = await SELF.fetch('http://localhost:3000/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: true,
			});

			expect(response.headers.get('Set-Cookie')).toContain('sid');
			expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
			expect(response.headers.get('Set-Cookie')).toContain('Secure');

			const sid = response.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sid).toBeTruthy();
		});

		it('returns false if login is unsuccessful', async () => {
			const response = await SELF.fetch('http://localhost:3000/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserEmail, password: 'wrong-password' }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({
				success: false,
			});
		});
	});

	describe('logout', () => {
		it('can logout a user', async () => {
			const loginResponse = await SELF.fetch('http://localhost:3000/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserEmail, password: testUserPassword }),
			});

			const sid = loginResponse.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sid).toBeDefined();

			const db = drizzle(env.D1, {
				schema,
			});
			let allSessions = await db.select().from(schema.sessions);
			expect(allSessions).toHaveLength(1);
			let session = allSessions[0];
			expect(session.valid).toBe(true);

			const response = await SELF.fetch('http://localhost:3000/logout', {
				method: 'POST',
				headers: {
					Cookie: `sid=${sid}`,
				},
			});

			expect(response.status).toBe(200);
			const sidAfterLogout = response.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sidAfterLogout).toBe('');
			expect(await response.json()).toMatchObject({
				success: true,
			});

			allSessions = await db.select().from(schema.sessions);
			expect(allSessions).toHaveLength(1);
			session = allSessions[0];
			expect(session.valid).toBe(false);
		});

		it('logout success false if no sid', async () => {
			const response = await SELF.fetch('http://localhost:3000/logout', {
				method: 'POST',
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
			});
		});
	});
});
