import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, expect, it } from 'vitest';

let db: SqliteDatabase;

beforeEach(() => {
	// Create new in-memory database for each test
	db = new Database(':memory:');
	db.pragma('journal_mode = WAL');

	// Read and execute schema
	const schema = readFileSync(join(__dirname, '../../schema.sql'), 'utf-8');

	db.exec(schema);
});

it('should insert a new user', () => {
	const insert = db.prepare('INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ? ,?)');
	const result = insert.run(
		1,
		'john_doe',
		'john@test.com',
		'password123',
	);
	expect(result.changes).toBe(1);
});

afterEach(() => {
	// Close database connection
	db.close();
});
