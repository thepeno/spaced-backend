import { users } from '@/db/user';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, beforeEach, expect, it } from 'vitest';

beforeEach(async () => {
	await env.D1.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password_hash TEXT)');
});

// it('should insert a new user', async () => {
// 	const { success } = await env.D1.prepare('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)')
// 		.bind(1, 'testuser', 'test@gmail.com', 'password')
// 		.run();
// 	expect(success).toBe(true);
// 	const { results } = await env.D1.prepare('SELECT * FROM users').all();

// 	expect(results.length).toBe(1);
// 	expect(results[0].username).toBe('testuser');
// });

it('should insert a new user', async () => {
	const db = drizzle(env.D1, {
		schema: {
			users,
		},
	});

	const [user] = await db
		.insert(users)
		.values({
			id: 1,
			username: 'testuser',
			email: 'test@email.com',
			password_hash: 'password',
		})
		.returning();

	expect(user.id).toBe(1);
	expect(user.username).toBe('testuser');
});

afterEach(() => {
	// Close database connection
});
