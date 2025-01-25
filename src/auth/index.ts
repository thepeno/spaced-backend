// ? NOTE: I didn't come up with this code on my own,
// based on https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html

import { DB } from '@/db';
import * as schema from '@/db/schema';
import { User } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const SESSION_COOKIE_NAME = 'sid';
export const COOKIE_EXPIRATION_TIME_MS = 1000 * 60 * 60 * 24 * 30;

// It's a good start for a hobby project
export async function hashPassword(password: string, providedSalt?: Uint8Array): Promise<string> {
	const encoder = new TextEncoder();
	const salt = providedSalt || crypto.getRandomValues(new Uint8Array(16));

	const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);

	const hash = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: salt,
			iterations: 310000,
			hash: 'SHA-256',
		},
		keyMaterial,
		256 // 32 bytes
	);

	const combined = new Uint8Array(salt.length + hash.byteLength);
	combined.set(salt);
	combined.set(new Uint8Array(hash), salt.length);

	// Convert to base64
	return btoa(String.fromCharCode(...combined));
}

export async function verifyPassword(storedHash: string, passwordAttempt: string): Promise<boolean> {
	try {
		// Decode from base64
		const combined = new Uint8Array(
			atob(storedHash)
				.split('')
				.map((c) => c.charCodeAt(0))
		);

		// Split into salt and hash
		const salt = combined.slice(0, 16);
		const originalHash = combined.slice(16);

		const attemptHashWithSalt = await hashPassword(passwordAttempt, salt);
		const attemptCombined = new Uint8Array(
			atob(attemptHashWithSalt)
				.split('')
				.map((c) => c.charCodeAt(0))
		);
		const attemptHash = attemptCombined.slice(16);

		// Constant-time comparison
		if (attemptHash.length !== originalHash.length) return false;
		let result = 0;
		for (let i = 0; i < attemptHash.length; i++) {
			result |= attemptHash[i] ^ originalHash[i];
		}
		return result === 0;
	} catch (e) {
		return false;
	}
}

export const USER_ALREADY_EXISTS_ERROR_MSG = 'User already exists';

type CreateUserResult =
	| {
			success: true;
			user: User;
	  }
	| {
			success: false;
			error: string;
	  };

export async function createUser(db: DB, email: string, password: string): Promise<CreateUserResult> {
	const existingUser = await db.query.users.findFirst({
		where: eq(schema.users.email, email),
	});

	if (existingUser) {
		return {
			success: false,
			error: USER_ALREADY_EXISTS_ERROR_MSG,
		};
	}

	const passwordHash = await hashPassword(password);

	const [user] = await db
		.insert(schema.users)
		.values({
			id: crypto.randomUUID(),
			email,
			passwordHash,
		})
		.returning();

	return {
		success: true,
		user,
	};
}

export async function getUser(db: DB, email: string): Promise<User | null> {
	const user = await db.query.users.findFirst({
		where: eq(schema.users.email, email),
	});

	if (!user) {
		return null;
	}

	return user;
}

type CreateSessionResult =
	| {
			success: true;
			session: schema.Session['id'];
	  }
	| {
			success: false;
			error: string;
	  };

export const SESSION_CREATION_ERROR_MSG = 'Failed to create session';

export async function createSession(db: DB, userId: string): Promise<CreateSessionResult> {
	try {
		const sessionId = crypto.randomUUID();
		const [session] = await db
			.insert(schema.sessions)
			.values({
				id: sessionId,
				userId,
				expiresAt: new Date(Date.now() + COOKIE_EXPIRATION_TIME_MS),
			})
			.returning();

		return {
			success: true,
			session: session.id,
		};
	} catch (e) {
		return {
			success: false,
			error: SESSION_CREATION_ERROR_MSG,
		};
	}
}

type InvalidateSessionResult =
	| {
			success: true;
	  }
	| {
			success: false;
			error: string;
	  };

const INVALIDATE_SESSION_NOT_FOUND_ERROR_MSG = 'Session not found';

export async function invalidateSession(db: DB, sessionId: string): Promise<InvalidateSessionResult> {
	const results = await db.update(schema.sessions).set({ valid: false }).where(eq(schema.sessions.id, sessionId)).returning();

	if (results.length === 0) {
		return {
			success: false,
			error: INVALIDATE_SESSION_NOT_FOUND_ERROR_MSG,
		};
	}

	if (results.length > 1) {
		throw new Error(`Multiple sessions found for id ${sessionId}`);
	}

	return {
		success: true,
	};
}

type GetSessionResult =
	| {
			success: true;
			session: schema.Session;
	  }
	| {
			success: false;
			error: string;
	  };

const GET_SESSION_NOT_FOUND_ERROR_MSG = 'Session not found';

export async function getSession(db: DB, sessionId: string): Promise<GetSessionResult> {
	const [session] = await db
		.update(schema.sessions)
		.set({
			lastActiveAt: new Date(),
		})
		.where(eq(schema.sessions.id, sessionId))
		.returning();

	if (!session) {
		return {
			success: false,
			error: GET_SESSION_NOT_FOUND_ERROR_MSG,
		};
	}

	return {
		success: true,
		session,
	};
}
