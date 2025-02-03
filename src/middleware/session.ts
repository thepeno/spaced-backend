import { getSession, SESSION_COOKIE_NAME } from '@/auth';
import * as schema from '@/db/schema';
import logger from '@/logger';
import { drizzle } from 'drizzle-orm/d1';
import { cache } from 'hono/cache';
import { getSignedCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

export const sessionMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: {
		userId: string;
	};
}>(async (c, next) => {
	const cookie = await getSignedCookie(c, c.env.COOKIE_SECRET);
	const sid = cookie[SESSION_COOKIE_NAME];

	logger.info({ sid }, 'Session middleware');

	if (!sid) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const db = drizzle(c.env.D1, {
		schema,
	});
	const session = await getSession(db, sid);

	if (!session.success) {
		logger.info({ sid, error: session.error }, 'Session middleware failed');
		return c.json({ error: 'Unauthorized' }, 401);
	}

	if (!session.session.valid) {
		logger.info({ sid, error: 'Session invalid' }, 'Session middleware failed');
		return c.json({ error: 'Unauthorized' }, 401);
	}

	if (session.session.expiresAt.getTime() < Date.now()) {
		logger.info({ sid, error: 'Session expired' }, 'Session middleware failed');
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('userId', session.session.userId);
	logger.info({ sid, userId: session.session.userId }, 'Session middleware successful');

	await cache({
		cacheControl: 'no-store, private, no-cache, revalidate',
		cacheName: 'session',
	})(c, next);
});
