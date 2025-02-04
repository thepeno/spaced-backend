import { DB } from '@/db';
import * as schema from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import * as jose from 'jose';
import { z } from 'zod';

export const googleTokenPayloadSchema = z.object({
	// Standard JWT claims
	iss: z.literal('https://accounts.google.com'),
	sub: z.string(), // Google's unique user ID
	aud: z.string(), // Should match your client ID
	exp: z.number(),
	iat: z.number(),

	// Google-specific claims
	email: z.string().email(),
	email_verified: z.boolean(),
	name: z.string().optional(),
	picture: z.string().url().optional(),
	given_name: z.string().optional(),
	family_name: z.string().optional(),
	locale: z.string().optional(),
	hd: z.string().optional(), // Hosted domain (if using Google Workspace)
});

/**
 * Verifies the Google JWT token and returns the payload.
 * @param jwt - The Google JWT token to verify.
 * @param clientId - The client ID of the application.
 * @returns The payload of the Google JWT token.
 */
export async function extractGooglePayload(jwt: string, clientId: string) {
	const JWKS = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
	const { payload } = await jose.jwtVerify(jwt, JWKS, {
		// Expected values that must match
		issuer: 'https://accounts.google.com',
		audience: clientId,
	});

	return googleTokenPayloadSchema.parse(payload);
}

export type GooglePayload = z.infer<typeof googleTokenPayloadSchema>;

type CreateOrSignInGoogleUserResult =
	| {
			success: true;
			user: schema.User;
	  }
	| {
			success: false;
			error: string;
	  };

export async function createOrSignInGoogleUser(
	db: DB,
	payload: GooglePayload
): Promise<CreateOrSignInGoogleUserResult> {
	const existingUser = await db.query.users.findFirst({
		where: eq(schema.users.email, payload.email),
		with: {
			oauthAccounts: true,
		},
	});

	if (existingUser) {
		const accounts = existingUser.oauthAccounts.filter((account) => account.provider === 'google');

		if (accounts.length === 0) {
			await db.insert(schema.oauthAccounts).values({
				id: crypto.randomUUID(),
				userId: existingUser.id,
				provider: 'google',
				providerUserId: payload.sub,
			});
		}

		await db
			.update(schema.users)
			.set({
				imageUrl: payload.picture,
				lastModified: new Date(),
			})
			.where(and(eq(schema.users.id, existingUser.id), isNull(schema.users.imageUrl)));

		return {
			success: true,
			user: existingUser,
		};
	}

	const [user] = await db
		.insert(schema.users)
		.values({
			id: crypto.randomUUID(),
			email: payload.email,
			imageUrl: payload.picture,
			displayName: payload.name,
			passwordHash: '',
		})
		.returning();

	await db.insert(schema.oauthAccounts).values({
		id: crypto.randomUUID(),
		userId: user.id,
		provider: 'google',
		providerUserId: payload.sub,
	});

	return {
		success: true,
		user,
	};
}
