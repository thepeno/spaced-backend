import { GooglePayload } from '@/auth/google';
import { handleClientOperation } from '@/client2server';
import * as schema from '@/db/schema';
import { env, SELF } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';

const testUserPassword = 'test-user-password';
const testUserEmail = 'test@email.com';
const testUser2Email = 'test2@email.com';

export const testUserCredentials = {
	email: testUserEmail,
	password: testUserPassword,
} as const;

export const testUser2Credentials = {
	email: testUser2Email,
	password: testUserPassword,
} as const;

export const testOAuthUser = {
	id: 'test-oauth',
	email: 'test-oauth@email.com',
	providerUserId: 'test-oauth-user-id',
	provider: 'google',
} as const;

export const testGooglePayload: GooglePayload = {
	email: testOAuthUser.email,
	email_verified: true,
	sub: testOAuthUser.providerUserId,
	iss: 'https://accounts.google.com',
	aud: '421029814925-ogt7pqsgo2j7f1bnjajk02aiasrcrf2f.apps.googleusercontent.com',
	exp: 1717171717,
	iat: 1717171717,
	name: 'Test User',
	picture: 'https://example.com/picture.png',
	given_name: 'Test',
	family_name: 'User',
	locale: 'en',
};

export const testUser = {
	id: 'test',
	email: testUserEmail,
	passwordHash: 'Xj+SO0CHAnpDOZyhr2+KAojZiIxA+ns2Oa3M8/uCxACqqWLH6PfCNTuEtuBfyUmt',
} satisfies schema.NewUser;

export const testUser2 = {
	id: 'test2',
	email: testUser2Email,
	passwordHash: 'Xj+SO0CHAnpDOZyhr2+KAojZiIxA+ns2Oa3M8/uCxACqqWLH6PfCNTuEtuBfyUmt',
} satisfies schema.NewUser;

export const testClientId = 'test-1';
export const testClientId2 = 'test-2';
export const testUser2ClientId = 'test-2-1';

export async function createTestUsers(): Promise<schema.User> {
	const db = drizzle(env.D1, {
		schema,
	});

	const [user, user2] = await db
		.insert(schema.users)
		.values([
			testUser,
			testUser2,
			{
				id: testOAuthUser.id,
				email: testOAuthUser.email,
			},
		])
		.returning();

	if (!user) {
		throw new Error('Failed to create user');
	}

	await db.insert(schema.oauthAccounts).values([
		{
			id: testOAuthUser.id,
			userId: testOAuthUser.id,
			provider: testOAuthUser.provider,
			providerUserId: testOAuthUser.providerUserId,
		},
	]);

	await db.insert(schema.clients).values([
		{
			id: testClientId,
			userId: user.id,
		},
		{
			id: testClientId2,
			userId: user.id,
		},
		{
			id: testUser2ClientId,
			userId: user2.id,
		},
	]);

	return user;
}

export async function loginTestUser(
	user: { email: string; password: string } = {
		email: testUserEmail,
		password: testUserPassword,
	}
): Promise<{
	cookie: string;
}> {
	const response = await SELF.fetch('http://localhost:3000/api/auth/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			email: user.email,
			password: user.password,
		}),
	});

	const cookie = response.headers.get('Set-Cookie');
	if (!cookie) {
		throw new Error('Failed to login');
	}

	return {
		cookie,
	};
}

const now = 100000;

export const DEFAULT_CARD_VARS = {
	due: new Date(now),
	stability: 0.5,
	difficulty: 0.5,
	elapsed_days: 0,
	scheduled_days: 0,
	reps: 0,
	lapses: 0,
	state: 'New',
	last_review: null,
} as const;

export const DEFAULT_REVIEW_LOG_VARS = {
	grade: 'Easy',
	state: 'New',
	due: new Date(now),
	stability: 0.5,
	difficulty: 0.5,
	elapsed_days: 0,
	last_elapsed_days: 0,
	scheduled_days: 0,
	review: new Date(now),
	duration: 0,
} as const;

export async function createTestCardsTestUser1(): Promise<void> {
	await handleClientOperation(
		{
			clientId: testClientId,
			userId: testUser.id,
			type: 'card',
			timestamp: now,
			payload: {
				id: 'test-card-1',
				...DEFAULT_CARD_VARS,
			},
		},
		env.D1
	);

	await handleClientOperation(
		{
			clientId: testClientId,
			userId: testUser.id,
			type: 'card',
			timestamp: now,
			payload: {
				id: 'test-card-2',
				...DEFAULT_CARD_VARS,
			},
		},
		env.D1
	);
}
