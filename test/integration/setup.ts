import { env } from 'cloudflare:test';
import { beforeEach } from 'vitest';
import { schemaString } from './sql';

beforeEach(async () => {
	const statements = schemaString
		// the way our bash script processes the statements might lead to double semicolons
		.replace(/;\s*;/g, ';')
		// We use statement breakpoints instead of semicolons because some statements, like triggers
		// contain multiple semicolons
		.split('--> statement-breakpoint')
		// Executing an empty string will throw an error
		.filter((s) => s.trim().length > 1);
	for (const statement of statements) {
		console.log(statement);
		await env.D1.prepare(statement).run();
		console.log('--------------------------------');
	}
});
