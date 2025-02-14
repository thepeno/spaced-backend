import {
	COOKIE_EXPIRATION_TIME_MS,
	createSession,
	createTempUser,
	getTempUser,
	getUser,
	invalidateSession,
	SESSION_COOKIE_NAME,
	updateTempUserLastEmailSentAt,
	verifyPassword,
} from '@/auth';
import {
	createUserFromTempUser,
	isTimeToResendEmail,
	sendEmailVerifyEmail,
	verifyEmail,
} from '@/auth/email-verify';
import { createOrSignInGoogleUser, extractGooglePayload } from '@/auth/google';
import { handleClientOperations, opToClient2ServerOp, validateOpCount } from '@/client2server';
import { createClientId } from '@/clientid';
import * as schema from '@/db/schema';
import { clientIdMiddleware } from '@/middleware/clientid';
import { sessionMiddleware } from '@/middleware/session';
import { operationSchema } from '@/operation';
import { getAllOpsFromSeqNoExclClient } from '@/server2client';
import {
	checkIfFileExists,
	insertFileEntryIntoDb,
	isValidUploadFileType,
	parseFileMetadata,
} from '@/upload';
import { redactEmail } from '@/utils';
import { zValidator } from '@hono/zod-validator';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { logger as requestLogger } from 'hono/logger';
import { CookieOptions } from 'hono/utils/cookie';
import { z } from 'zod';
import logger from './logger';

const app = new Hono<{ Bindings: Env }>().basePath('/api');
app.use(requestLogger());

app.use('*', async (c, next) => {
	const corsMiddleware = cors({
		origin: c.env.FRONTEND_ORIGIN,
		allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Id'],
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		credentials: true,
	});

	return corsMiddleware(c, next);
});

// We have to make the cookie options dynamically
// because we want the expiration time to be dynamic
// In addition, Cloudflare date seems to be Unix 0 time when this code initially runs,
// so the expires was always in the past.
const makeDevCookieOptions: () => CookieOptions = () => ({
	expires: new Date(Date.now() + COOKIE_EXPIRATION_TIME_MS),
	httpOnly: true,
	secure: false,
});

const makeProdCookieOptions: () => CookieOptions = () => ({
	expires: new Date(Date.now() + COOKIE_EXPIRATION_TIME_MS),
	httpOnly: true,
	secure: true,
	// ?: is this needed?
	// domain: '.zsheng.app', // Allow all subdomains
	// path: '/', // Accessible across all paths
	// sameSite: 'Lax', // Or 'None' if needed for cross-origin (requires Secure)
});

app.get('/', (c) => {
	return c.text('OK');
});

app.post(
	'/auth/register',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
			password: z.string().min(8).max(128),
		})
	),
	async (c) => {
		const { email, password } = c.req.valid('json');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const createTempUserResult = await createTempUser(db, email, password);

		if (!createTempUserResult.success) {
			logger.info({ email, error: createTempUserResult.error }, 'createTempUserResult failed');
			return c.json({
				success: false,
				error: createTempUserResult.error,
			});
		}

		const sendEmailVerifyEmailResult = await sendEmailVerifyEmail(
			email,
			createTempUserResult.tempUser.token,
			c.env.RESEND_API_KEY,
			c.env.WORKER_ENV
		);

		if (!sendEmailVerifyEmailResult.success) {
			logger.info(
				{ email: redactEmail(email), error: sendEmailVerifyEmailResult.error },
				'sendEmailVerifyEmailResult failed'
			);
			return c.json({
				success: false,
				error: sendEmailVerifyEmailResult.error,
			});
		}

		const updateTempUserLastEmailSentAtResult = await updateTempUserLastEmailSentAt(db, email);
		if (!updateTempUserLastEmailSentAtResult.success) {
			logger.info(
				{ email: redactEmail(email), error: updateTempUserLastEmailSentAtResult.error },
				'updateTempUserLastEmailSentAtResult failed'
			);
			return c.json({
				success: false,
				error: updateTempUserLastEmailSentAtResult.error,
			});
		}

		logger.info({ email: redactEmail(email) }, 'register request successful');
		return c.json({
			success: true,
		});
	}
);

app.post(
	'/auth/verify',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
			token: z.string(),
		})
	),
	async (c) => {
		const { email, token } = c.req.valid('json');

		logger.info({ email: redactEmail(email), token }, 'verify request');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const user = await getUser(db, email);

		if (user) {
			logger.info({ email: redactEmail(email) }, 'verify request failed: user already verified');
			return c.json({
				success: false,
				error: 'User already verified',
			});
		}

		const tempUser = await getTempUser(db, email);
		if (!tempUser) {
			logger.info({ email: redactEmail(email) }, 'verify request failed: temp user not found');
			return c.json({
				success: false,
				error: 'User not found',
			});
		}

		const verifyEmailResult = await verifyEmail(tempUser, token);

		if (!verifyEmailResult.success) {
			logger.info(
				{ email: redactEmail(email), error: verifyEmailResult.error },
				'verify request failed: verifyEmailResult failed'
			);
			return c.json({
				success: false,
				error: verifyEmailResult.error,
			});
		}

		const createUserFromTempUserResult = await createUserFromTempUser(db, tempUser);

		if (!createUserFromTempUserResult.success) {
			logger.info(
				{ email: redactEmail(email), error: createUserFromTempUserResult.error },
				'verify request failed: createUserFromTempUserResult failed'
			);
			return c.json({
				success: false,
				error: createUserFromTempUserResult.error,
			});
		}

		const createSessionResult = await createSession(db, tempUser.id);

		if (!createSessionResult.success) {
			logger.info(
				{ email: redactEmail(email), error: createSessionResult.error },
				'verify request failed: createSessionResult failed'
			);
			return c.json({
				success: false,
				error: createSessionResult.error,
			});
		}

		const cookieOptions =
			c.env.WORKER_ENV === 'local' ? makeDevCookieOptions() : makeProdCookieOptions();
		setSignedCookie(
			c,
			SESSION_COOKIE_NAME,
			createSessionResult.session,
			c.env.COOKIE_SECRET,
			cookieOptions
		);

		logger.info({ email: redactEmail(email) }, 'verify request successful');
		return c.json({
			success: true,
		});
	}
);

app.post(
	'/auth/resend-email',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
		})
	),
	async (c) => {
		const { email } = c.req.valid('json');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const tempUser = await getTempUser(db, email);
		if (!tempUser) {
			return c.json({
				success: false,
				error: 'User not found',
			});
		}

		if (!isTimeToResendEmail(tempUser.lastEmailSentAt)) {
			return c.json({
				success: false,
				error: 'Not enough time has passed',
			});
		}

		const sendEmailVerifyEmailResult = await sendEmailVerifyEmail(
			email,
			tempUser.token,
			c.env.RESEND_API_KEY,
			c.env.WORKER_ENV
		);
		if (!sendEmailVerifyEmailResult.success) {
			return c.json({
				success: false,
				error: sendEmailVerifyEmailResult.error,
			});
		}

		return c.json({
			success: true,
		});
	}
);

app.post(
	'/auth/login',
	zValidator(
		'json',
		z.object({
			email: z.string().email(),
			password: z.string(),
		})
	),
	async (c) => {
		const { email, password } = c.req.valid('json');
		logger.info({ email: redactEmail(email) }, 'Login request');
		const db = drizzle(c.env.D1, {
			schema,
		});

		const user = await getUser(db, email);

		if (!user) {
			const tempUser = await getTempUser(db, email);
			if (tempUser) {
				logger.info({ email: redactEmail(email) }, 'Login request failed: temp user found');
				c.status(401);
				return c.json({
					success: false,
					isTempUser: true,
				});
			}

			logger.info({ email: redactEmail(email) }, 'Login request failed: user not found');
			c.status(401);
			return c.json({
				success: false,
			});
		}

		if (!user.passwordHash) {
			logger.info(
				{ email: redactEmail(email) },
				'Login request failed: user has not set a password'
			);
			c.status(401);
			return c.json({
				success: false,
			});
		}

		const valid = await verifyPassword(user.passwordHash, password);

		if (!valid) {
			logger.info({ email: redactEmail(email) }, 'Login request failed: invalid password');
			c.status(401);
			return c.json({
				success: false,
			});
		}

		const createSessionResult = await createSession(db, user.id);

		if (!createSessionResult.success) {
			logger.error({ email: redactEmail(email) }, 'Login request failed: create session failed');
			c.status(500);
			return c.json({
				success: false,
			});
		}

		const cookieOptions =
			c.env.WORKER_ENV === 'local' ? makeDevCookieOptions() : makeProdCookieOptions();
		setSignedCookie(
			c,
			SESSION_COOKIE_NAME,
			createSessionResult.session,
			c.env.COOKIE_SECRET,
			cookieOptions
		);
		logger.info({ email: redactEmail(email) }, 'Login request successful');
		return c.json({
			success: true,
		});
	}
);

app.post('/auth/logout', async (c) => {
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

app.get('/auth/me', sessionMiddleware, async (c) => {
	const userId = c.get('userId');
	logger.info({ userId }, 'GET /me request');

	return c.json({
		userId,
	});
});

// For requesting a new client ID
app.post('/auth/clientId', sessionMiddleware, async (c) => {
	const userId = c.get('userId');
	const clientId = await createClientId(drizzle(c.env.D1), userId);

	c.status(201);
	return c.json({
		clientId,
	});
});

app.post('/auth/google', async (c) => {
	const formData = await c.req.formData();
	const credential = formData.get('credential')?.toString();

	if (!credential) {
		return c.json({
			success: false,
		});
	}

	const payload = await extractGooglePayload(
		credential,
		'421029814925-ogt7pqsgo2j7f1bnjajk02aiasrcrf2f.apps.googleusercontent.com'
	);

	const db = drizzle(c.env.D1, {
		schema,
	});

	const createOrSignInGoogleUserResult = await createOrSignInGoogleUser(db, payload);

	if (!createOrSignInGoogleUserResult.success) {
		logger.error(
			{ email: redactEmail(payload.email), providerUserId: payload.sub },
			'createOrSignInGoogleUserResult failed'
		);
		return c.json({
			success: false,
		});
	}

	const createSessionResult = await createSession(db, createOrSignInGoogleUserResult.user.id);

	if (!createSessionResult.success) {
		logger.error(
			{ email: redactEmail(payload.email), providerUserId: payload.sub },
			'createSessionResult failed'
		);
		return c.json({
			success: false,
		});
	}

	const cookieOptions =
		c.env.WORKER_ENV === 'local' ? makeDevCookieOptions() : makeProdCookieOptions();
	setSignedCookie(
		c,
		SESSION_COOKIE_NAME,
		createSessionResult.session,
		c.env.COOKIE_SECRET,
		cookieOptions
	);

	const clientId = await createClientId(drizzle(c.env.D1), createOrSignInGoogleUserResult.user.id);

	return c.redirect(`${c.env.FRONTEND_ORIGIN}/login-success?clientId=${clientId}`);
});

// The simple version of  this is to execute all requests in sequence
// and only return when the requests are all done.
// TODO: error handling with exponential backoff for each client request
// TODO: non-blocking version (must buffer the requests for each client somehow)
app.post(
	'/sync',
	sessionMiddleware,
	clientIdMiddleware,
	zValidator(
		'json',
		z.object({
			ops: z.array(operationSchema),
		})
	),
	async (c) => {
		const userId = c.get('userId');
		const clientId = c.get('clientId');
		const { ops } = c.req.valid('json');

		const validateOpCountResult = validateOpCount(ops);
		if (!validateOpCountResult.success) {
			c.status(413);
			return c.json({
				success: false,
				error: validateOpCountResult.error,
			});
		}

		const clientOps = ops.map((op) => opToClient2ServerOp(op, userId, clientId));
		const performanceStart = performance.now();
		await handleClientOperations(clientOps, c.env.D1);
		const performanceEnd = performance.now();
		logger.info(`PERF Time taken: ${performanceEnd - performanceStart}ms`);

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

app.post(
	'/upload',
	bodyLimit({
		maxSize: 2 * 1024 * 1024, // 2MB
		onError: (c) => {
			c.status(413);
			return c.json({
				success: false,
				error: 'File too large',
			});
		},
	}),
	sessionMiddleware,
	async (c) => {
		const userId = c.get('userId');
		const body = await c.req.parseBody();

		const file = body.file;

		if (!file) {
			logger.info('No file uploaded');
			c.status(400);
			return c.json({
				success: false,
				error: 'No file uploaded',
			});
		}

		if (typeof file === 'string') {
			logger.info('File is a string');
			c.status(400);
			return c.json({
				success: false,
				error: 'File is a string',
			});
		}

		const db = drizzle(c.env.D1, {
			schema,
		});
		const fileExists = await checkIfFileExists(file, userId, db);

		if (fileExists.success) {
			logger.info({ fileKey: fileExists.fileKey }, 'File already exists');
			return c.json({
				success: true,
				fileKey: fileExists.fileKey,
			});
		}

		const fileType = file.type;
		if (!isValidUploadFileType(fileType)) {
			logger.info('Invalid file type');
			c.status(400);
			return c.json({
				success: false,
				error: 'Invalid file type',
			});
		}

		const fileId = crypto.randomUUID();
		const fileKey = `${userId}/${fileId}`;

		// We insert into the database first
		// If the triggers raise an error, we don't want to put the file into the bucket
		const metadata = body.metadata;
		const parsedMetadata = parseFileMetadata(file, metadata);

		const insertFileEntryIntoDbResult = await insertFileEntryIntoDb(
			file,
			fileExists.checksum,
			userId,
			fileId,
			parsedMetadata,
			db
		);
		if (!insertFileEntryIntoDbResult.success) {
			logger.error({ fileKey }, 'Failed to insert file entry into db');
			// currently we only ahve storage limit exceeded error
			c.status(413);
			return c.json({
				success: false,
				error: insertFileEntryIntoDbResult.error,
			});
		}

		await c.env.FILES_BUCKET.put(fileKey, file);
		logger.info({ fileKey }, 'Uploaded file');

		return c.json({
			success: true,
			fileKey,
		});
	}
);

app.get('/files/:fileUserId/:fileId', sessionMiddleware, async (c) => {
	const fileUserId = c.req.param('fileUserId');
	const fileId = c.req.param('fileId');

	const userId = c.get('userId');
	if (fileUserId !== userId) {
		logger.info({ fileUserId, userId }, 'File not for user');
		c.status(403);
		return c.json({
			success: false,
			error: 'File not for user',
		});
	}

	if (!fileId) {
		logger.info('No file id');
		c.status(400);
		return c.json({
			success: false,
			error: 'No file id',
		});
	}

	const fileKey = `${fileUserId}/${fileId}`;
	const file = await c.env.FILES_BUCKET.get(fileKey);

	if (!file) {
		logger.info({ fileKey }, 'File not found');
		c.status(404);
		return c.json({
			success: false,
			error: 'File not found',
		});
	}

	return c.body(file?.body);
});

export default app;
