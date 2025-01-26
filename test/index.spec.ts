// test/index.spec.ts
import { SESSION_COOKIE_NAME, USER_ALREADY_EXISTS_ERROR_MSG } from '@/auth';
import * as schema from '@/db/schema';
import { env, SELF } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
	createTestUser,
	loginTestUser,
	testUserEmail,
	testUserPassword,
} from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(async () => {
	await createTestUser();
});

const db = drizzle(env.D1, {
	schema,
});

describe('basic', () => {
	it('responds with OK (integration style)', async () => {
		const response = await SELF.fetch('http://localhost:3000/');
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});
});

describe('auth', () => {
	describe('/register', () => {
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
			expect(response.headers.get('Set-Cookie')).toContain(SESSION_COOKIE_NAME);
			expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
			expect(response.headers.get('Set-Cookie')).toContain('Secure');

			const sid = response.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sid).toBeTruthy();
		});
	});

	describe('/login', () => {
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

			expect(response.headers.get('Set-Cookie')).toContain(SESSION_COOKIE_NAME);
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

	describe('/logout', () => {
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
					Cookie: `${SESSION_COOKIE_NAME}=${sid}`,
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

	describe('/me session middleware', () => {
		let cookie: string;
		beforeEach(async () => {
			const { cookie: cookieFromLogin } = await loginTestUser();
			cookie = cookieFromLogin;
		});

		it('returns the user id', async () => {
			const response = await SELF.fetch('http://localhost:3000/me', {
				headers: {
					Cookie: cookie,
				},
			});

			const user = await db.query.users.findFirst({
				where: eq(schema.users.email, testUserEmail),
			});
			expect(user).toBeDefined();
			if (!user) {
				throw new Error('User not found');
			}

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				userId: user.id,
			});
		});

		it('returns 401 if no cookie', async () => {
			const response = await SELF.fetch('http://localhost:3000/me');
			expect(response.status).toBe(401);
		});

		it('returns 401 if cookie is invalid', async () => {
			const response = await SELF.fetch('http://localhost:3000/me', {
				headers: {
					Cookie: 'invalid-cookie',
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session does not exist', async () => {
			await db.delete(schema.sessions).execute();

			const response = await SELF.fetch('http://localhost:3000/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session is invalid', async () => {
			await db.update(schema.sessions).set({ valid: false });

			const response = await SELF.fetch('http://localhost:3000/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session is expired', async () => {
			await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });

			const response = await SELF.fetch('http://localhost:3000/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});
	});
});
