// test/index.spec.ts
import { SESSION_COOKIE_NAME, USER_ALREADY_EXISTS_ERROR_MSG } from '@/auth';
import * as google from '@/auth/google';
import * as schema from '@/db/schema';
import { env, SELF } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import {
	createTestUsers,
	loginTestUser,
	testGooglePayload,
	testOAuthUser,
	testUserCredentials,
} from 'test/integration/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(async () => {
	await createTestUsers();
	vi.resetAllMocks();
});

const db = drizzle(env.D1, {
	schema,
});

describe('basic', () => {
	it('responds with OK (integration style)', async () => {
		const response = await SELF.fetch('http://localhost:3000/api');
		expect(await response.text()).toMatchInlineSnapshot(`"OK"`);
	});
});

describe('auth', () => {
	describe('/register', () => {
		it('can register a user', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/register', {
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

			const drizzleDb = drizzle(env.D1, {
				schema,
			});

			const tempUser = await drizzleDb.query.tempUsers.findFirst({
				where: eq(schema.tempUsers.email, 'test@example.com'),
			});
			expect(tempUser).toBeDefined();
			expect(tempUser?.email).toBe('test@example.com');
			expect(tempUser?.passwordHash).toBeDefined();
			expect(tempUser?.token).toBeDefined();
			expect(tempUser?.tokenExpiresAt?.getTime()).toBeGreaterThan(Date.now());
		});

		it('returns error if password is too short', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'test@example.com', password: 'short' }),
			});

			expect(response.status).toBe(400);
		});

		it('returns error if password is too long', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'test@example.com', password: 'a'.repeat(129) }),
			});

			expect(response.status).toBe(400);
		});

		it('returns error if user already exists', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(testUserCredentials),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: USER_ALREADY_EXISTS_ERROR_MSG,
			});
		});
	});

	describe('/verify	', () => {
		const tempUserEmail = 'test@temp-email.com';
		beforeEach(async () => {
			await db.insert(schema.tempUsers).values({
				id: 'test-temp-user',
				email: tempUserEmail,
				passwordHash: 'password',
				token: 'test-token',
				tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
			});
		});

		it('can verify a user', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: tempUserEmail, token: 'test-token' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: true,
			});
			// cookie should be set
			expect(response.headers.get('Set-Cookie')).toContain(SESSION_COOKIE_NAME);
			expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
			expect(response.headers.get('Set-Cookie')).toContain('Secure');

			const sid = response.headers.get('Set-Cookie')?.split(';')[0].split('=')[1];
			expect(sid).toBeTruthy();
		});

		it('returns error if user is already verified', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserCredentials.email, token: 'test-token' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: 'User already verified',
			});
		});

		it('returns error if temp user does not exist', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'nonexistent@example.com', token: 'test-token' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: 'User not found',
			});
		});

		it('returns error if token is invalid', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: tempUserEmail, token: 'invalid-token' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: 'Invalid token',
			});
		});

		it('returns error if token has expired', async () => {
			await db
				.update(schema.tempUsers)
				.set({
					tokenExpiresAt: new Date(Date.now() - 10000),
				})
				.where(eq(schema.tempUsers.email, tempUserEmail));

			const response = await SELF.fetch('http://localhost:3000/api/auth/verify', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: tempUserEmail, token: 'expired-token' }),
			});

			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				success: false,
				error: 'Token expired',
			});
		});
	});

	describe('/login', () => {
		it('can login a user', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(testUserCredentials),
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
			const response = await SELF.fetch('http://localhost:3000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testUserCredentials.email, password: 'wrong-password' }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({
				success: false,
			});
		});

		it('returns false if user has not set a password (oauth)', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: testOAuthUser.email, password: 'password' }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({
				success: false,
			});
		});

		it('returns false if user is a temp user', async () => {
			await db.insert(schema.tempUsers).values({
				id: 'test-temp-user',
				email: 'test@temp-email.com',
				passwordHash: 'password',
				token: 'test-token',
				tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
			});

			const response = await SELF.fetch('http://localhost:3000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email: 'test@temp-email.com', password: 'password' }),
			});

			expect(response.status).toBe(401);
			expect(await response.json()).toMatchObject({
				success: false,
				isTempUser: true,
			});
		});;
	});

	describe('/auth/google', async () => {
		it('can login a user with google', async () => {
			const spy = vi.spyOn(google, 'extractGooglePayload');
			spy.mockResolvedValue(testGooglePayload);

			const response = await SELF.fetch('http://localhost:3000/api/auth/google', {
				method: 'POST',
				headers: {
					'Content-Type': `application/x-www-form-urlencoded`,
				},
				body: `credential=test-credential`,
				redirect: 'manual',
			});
			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toMatch(/\/login-success\?clientId=.+$/);
		});

		it('creates a new user for google', async () => {
			const spy = vi.spyOn(google, 'extractGooglePayload');
			spy.mockResolvedValue({
				email: 'new-oauth-user@gmail.com',
				email_verified: true,
				sub: 'test-sub',
				iss: 'https://accounts.google.com',
				aud: 'test-aud',
				exp: 1717171717,
				iat: 1717171717,
				name: 'Test User',
				picture: 'https://example.com/picture.png',
				given_name: 'Test',
				family_name: 'User',
				locale: 'en',
			});

			const response = await SELF.fetch('http://localhost:3000/api/auth/google', {
				method: 'POST',
				body: `credential=test-credential`,
				headers: {
					'Content-Type': `application/x-www-form-urlencoded`,
				},
				redirect: 'manual',
			});

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toMatch(/\/login-success\?clientId=.+$/);
		});

		it('adds the oauth account to an existing password user', async () => {
			const spy = vi.spyOn(google, 'extractGooglePayload');
			spy.mockResolvedValue({
				...testGooglePayload,
				email: testUserCredentials.email,
				sub: 'new-oauth-account-test-sub',
			});

			const response = await SELF.fetch('http://localhost:3000/api/auth/google', {
				method: 'POST',
				body: `credential=test-credential`,
				headers: {
					'Content-Type': `application/x-www-form-urlencoded`,
				},
				redirect: 'manual',
			});

			expect(response.status).toBe(302);
			expect(response.headers.get('Location')).toMatch(/\/login-success\?clientId=.+$/);

			const oauthAccount = await db.query.oauthAccounts.findFirst({
				where: eq(schema.oauthAccounts.providerUserId, 'new-oauth-account-test-sub'),
			});
			expect(oauthAccount).toBeDefined();

			const user = await db.query.users.findFirst({
				where: eq(schema.users.email, testUserCredentials.email),
			});
			expect(user?.imageUrl).toBeDefined();
			expect(user?.imageUrl).toBe(testGooglePayload.picture);
		});
	});

	describe('/logout', () => {
		it('can logout a user', async () => {
			const loginResponse = await SELF.fetch('http://localhost:3000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(testUserCredentials),
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

			const response = await SELF.fetch('http://localhost:3000/api/auth/logout', {
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
			const response = await SELF.fetch('http://localhost:3000/api/auth/logout', {
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
			const response = await SELF.fetch('http://localhost:3000/api/auth/me', {
				headers: {
					Cookie: cookie,
				},
			});

			const user = await db.query.users.findFirst({
				where: eq(schema.users.email, testUserCredentials.email),
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
			const response = await SELF.fetch('http://localhost:3000/api/auth/me');
			expect(response.status).toBe(401);
		});

		it('returns 401 if cookie is invalid', async () => {
			const response = await SELF.fetch('http://localhost:3000/api/auth/me', {
				headers: {
					Cookie: 'invalid-cookie',
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session does not exist', async () => {
			await db.delete(schema.sessions).execute();

			const response = await SELF.fetch('http://localhost:3000/api/auth/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session is invalid', async () => {
			await db.update(schema.sessions).set({ valid: false });

			const response = await SELF.fetch('http://localhost:3000/api/auth/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});

		it('returns 401 if session is expired', async () => {
			await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });

			const response = await SELF.fetch('http://localhost:3000/api/auth/me', {
				headers: {
					Cookie: cookie,
				},
			});
			expect(response.status).toBe(401);
		});
	});
});
