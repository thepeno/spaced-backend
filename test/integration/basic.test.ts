import { env } from 'cloudflare:test';
import { afterEach, beforeEach, expect, it } from 'vitest';


beforeEach(async () => {
	await env.D1.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, password_hash TEXT)');
});

it('should insert a new user', async () => {
	const { success } = await env.D1.prepare('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)')
		.bind(1, 'testuser', 'test@gmail.com', 'password')
		.run();
	expect(success).toBe(true);
	const { results } = await env.D1.prepare('SELECT * FROM users').all();

	expect(results.length).toBe(1);
	expect(results[0].username).toBe('testuser');
});

afterEach(() => {
	// Close database connection
});
