import * as schema from '@/db/schema';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';

export const testUser = {
	id: 'test',
	username: 'testuser',
	email: 'test@email.com',
	passwordHash: 'password',
}
export const testClientId = 'test-1';

export async function createTestUser(): Promise<schema.User> {
	const db = drizzle(env.D1, {
		schema,
	});

	const [user] = await db
		.insert(schema.users)
		.values({
			...testUser
		})
		.returning();

	if (!user) {
		throw new Error('Failed to create user');
	}

	await db.insert(schema.clients).values({
		id: testClientId,
		userId: user.id,
	});

	return user;
}
