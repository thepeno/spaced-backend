import {
	COOKIE_EXPIRATION_TIME_MS,
	createSession,
	createUser,
	getUser,
	invalidateSession,
	SESSION_COOKIE_NAME,
	verifyPassword,
} from '@/auth';
import { handleClientOperation, opToClient2ServerOp, validateOpCount } from '@/client2server';
import { createClientId } from '@/clientid';
import * as schema from '@/db/schema';
import { clientIdMiddleware } from '@/middleware/clientid';
import { sessionMiddleware } from '@/middleware/session';
import { operationSchema } from '@/operation';
import { getAllOpsFromSeqNoExclClient } from '@/server2client';
import { zValidator } from '@hono/zod-validator';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { logger } from 'hono/logger';
import { CookieOptions } from 'hono/utils/cookie';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();
app.use(logger());

const devCookieOptions: CookieOptions = {
	expires: new Date(Date.now() + COOKIE_EXPIRATION_TIME_MS),
	httpOnly: true,
	secure: false,
};

const prodCookieOptions: CookieOptions = {
	expires: new Date(Date.now() + COOKIE_EXPIRATION_TIME_MS),
	httpOnly: true,
	secure: true,
};

app.get('/', (c) => {
	return c.text('OK');
});

app.post(
	'/register',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
			password: z.string(),
		})
	),
	async (c) => {
		const { email, password } = c.req.valid('json');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const createUserResult = await createUser(db, email, password);

		if (!createUserResult.success) {
			return c.json({
				success: false,
				error: createUserResult.error,
			});
		}

		const createSessionResult = await createSession(db, createUserResult.user.id);

		if (!createSessionResult.success) {
			return c.json({
				success: false,
				error: createSessionResult.error,
			});
		}

		const cookieOptions = c.env.WORKER_ENV === 'local' ? devCookieOptions : prodCookieOptions;
		setSignedCookie(
			c,
			SESSION_COOKIE_NAME,
			createSessionResult.session,
			c.env.COOKIE_SECRET,
			cookieOptions
		);

		return c.json({
			success: true,
		});
	}
);

app.post(
	'/login',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
			password: z.string(),
		})
	),
	async (c) => {
		const { email, password } = c.req.valid('json');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const user = await getUser(db, email);

		if (!user) {
			c.status(401);
			return c.json({
				success: false,
			});
		}

		const valid = await verifyPassword(user.passwordHash, password);

		if (!valid) {
			c.status(401);
			return c.json({
				success: false,
			});
		}

		const createSessionResult = await createSession(db, user.id);

		if (!createSessionResult.success) {
			c.status(500);
			return c.json({
				success: false,
			});
		}

		const cookieOptions = c.env.WORKER_ENV === 'local' ? devCookieOptions : prodCookieOptions;
		setSignedCookie(
			c,
			SESSION_COOKIE_NAME,
			createSessionResult.session,
			c.env.COOKIE_SECRET,
			cookieOptions
		);

		return c.json({
			success: true,
		});
	}
);

app.post('/logout', async (c) => {
	const sid = await getSignedCookie(c, c.env.COOKIE_SECRET, SESSION_COOKIE_NAME);
	if (!sid) {
		return c.json({
			success: false,
		});
	}

	deleteCookie(c, SESSION_COOKIE_NAME);

	const db = drizzle(c.env.D1, {
		schema,
	});

	const invalidateSessionResult = await invalidateSession(db, sid);
	if (!invalidateSessionResult.success) {
		return c.json({
			success: false,
			error: invalidateSessionResult.error,
		});
	}

	return c.json({
		success: true,
	});
});

app.get('/me', sessionMiddleware, async (c) => {
	const userId = c.get('userId');

	return c.json({
		userId,
	});
});

// For requesting a new client ID
app.post('/clientId', sessionMiddleware, async (c) => {
	const userId = c.get('userId');
	const clientId = await createClientId(drizzle(c.env.D1), userId);

	c.status(201);
	return c.json({
		clientId,
	});
});

// The simple version of  this is to execute all requests in sequence
// and only return when the requests are all done.
// TODO: error handling with exponential backoff for each client request
// TODO: non-blocking version (must buffer the requests for each client somehow)
app.post(
	'/sync',
	sessionMiddleware,
	clientIdMiddleware,
	zValidator('json', z.array(operationSchema)),
	async (c) => {
		const userId = c.get('userId');
		const clientId = c.get('clientId');
		const ops = c.req.valid('json');

		const validateOpCountResult = validateOpCount(ops);
		if (!validateOpCountResult.success) {
			c.status(413);
			return c.json({
				success: false,
				error: validateOpCountResult.error,
			});
		}

		const clientOps = ops.map((op) => opToClient2ServerOp(op, userId, clientId));
		for (const op of clientOps) {
			await handleClientOperation(op, c.env.D1);
		}

		return c.json({
			success: true,
		});
	}
);

app.get(
	'/sync',
	sessionMiddleware,
	clientIdMiddleware,
	zValidator(
		'query',
		z.object({
			seqNo: z.coerce.number(),
		})
	),
	async (c) => {
		const { seqNo } = c.req.valid('query');
		const clientId = c.get('clientId');
		const userId = c.get('userId');

		const db = drizzle(c.env.D1, {
			schema,
		});
		const clientOps = await getAllOpsFromSeqNoExclClient(db, userId, clientId, seqNo);

		return c.json({
			ops: clientOps,
		});
	}
);

export default app;
