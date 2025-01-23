import * as schema from '@/db/schema';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { expect, it } from 'vitest';

it('should insert a new user', async () => {
	const db = drizzle(env.D1, {
		schema,
	});

	const [user] = await db
		.insert(schema.users)
		.values({
			id: 'test',
			username: 'testuser',
			email: 'test@email.com',
			passwordHash: 'password',
		})
		.returning();

	expect(user.id).toBe('test');
	expect(user.username).toBe('testuser');
});
