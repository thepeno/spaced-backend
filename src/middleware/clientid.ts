import { createMiddleware } from "hono/factory";

/**
 * Middleware that checks for a client ID in the request headers and sets it in the request context.
 *
 * Note: we allow the client to decide their own client ID.
 * Client IDs are only created when a user logs in.
 */
export const clientIdMiddleware = createMiddleware<{
	Bindings: Env;
	Variables: {
		clientId: string;
	}
}>(async (c, next) => {
	const clientId = c.req.header('X-Client-Id');

	if (!clientId) {
		c.status(400);
		return c.json({ error: 'Missing X-Client-Id header' });
	}

	c.set('clientId', clientId);
	await next();
});
