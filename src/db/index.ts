import * as schema from '@/db/schema';
import { DrizzleD1Database } from 'drizzle-orm/d1';

export type DB = DrizzleD1Database<typeof schema> & {
	$client: D1Database;
};
