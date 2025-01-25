import { getSession, SESSION_COOKIE_NAME } from '@/auth';
import * as schema from '@/db/schema';
import { drizzle } from 'drizzle-orm/d1';
import { getSignedCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

export const sessionMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: {
		userId: string;
		userEmail: string;
	}
}>(async (c, next) => {
	const cookie = await getSignedCookie(c, c.env.COOKIE_SECRET);
	const sid = cookie[SESSION_COOKIE_NAME];

	if (!sid) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const db = drizzle(c.env.D1, {
		schema,
	});
	const session = await getSession(db, sid);

	if (!session.success) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	if (!session.session.valid) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	if (session.session.expiresAt.getTime() < Date.now()) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	c.set('userId', session.session.userId);
	await next();
});
