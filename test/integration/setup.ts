import { env } from 'cloudflare:test';
import { beforeEach } from 'vitest';
import { schemaString } from './sql';

beforeEach(async () => {
	const statements = schemaString.split(';').filter((s) => s.trim().length > 0);
	for (const statement of statements) {
		await env.D1.prepare(statement).run();
	}
});
