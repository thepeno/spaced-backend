import { DB } from '@/db';
import { TempUser, tempUsers, users, userStorageMetrics } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';

const MIN_TIME_BETWEEN_EMAILS_MS = 30 * 1000; // 30 seconds

export function isTimeToResendEmail(lastEmailSentAt: Date) {
	const now = new Date();
	const timeSinceLastEmail = now.getTime() - lastEmailSentAt.getTime();
	return timeSinceLastEmail >= MIN_TIME_BETWEEN_EMAILS_MS;
}

function generateEmailVerifyEmailHtml(token: string) {
	return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.5;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 32px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
});

export type TempUser = typeof tempUsers.$inferSelect;
export type NewTempUser = typeof tempUsers.$inferInsert;

export const users = sqliteTable(
	'users',
            margin: 0;
          }
          .message {
            margin: 24px 0;
          }
          .token {
            background-color: #f5f5f5;
            border-radius: 4px;
            padding: 12px;
            font-family: monospace;
            font-size: 16px;
            text-align: center;
            margin: 16px 0;
          }
          .footer {
            font-size: 14px;
            color: #666;
            text-align: center;
            margin-top: 24px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">Email Verification</h1>
          </div>
          <div class="message">
            <p>Thank you for signing up! To complete your registration, please use the verification token below:</p>
            <div class="token">${token}</div>
            <p>If you didn't request this verification, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

type SendEmailVerifyResponse =
	| {
			success: true;
	  }
	| {
			success: false;
			error: string;
	  };

export async function sendEmailVerifyEmail(
	email: string,
	token: string,
	apiKey: string,
	workerEnv: 'local' | 'production'
): Promise<SendEmailVerifyResponse> {
	if (workerEnv === 'local') {
		return { success: true };
	}

	const resend = new Resend(apiKey);

	const { error } = await resend.emails.send({
		from: 'Spaced <no-reply@updates.spaced.zsheng.app>',
		to: email,
		subject: 'Email Verification',
		html: generateEmailVerifyEmailHtml(token),
	});

	if (error) {
		return {
			success: false,
			error: error.message,
		};
	}

	return { success: true };
}

type VerifyEmailResponse = {
	success: boolean;
	error?: string;
};

export async function verifyEmail(tempUser: TempUser, token: string): Promise<VerifyEmailResponse> {
	if (tempUser.tokenExpiresAt.getTime() < Date.now()) {
		return { success: false, error: 'Token expired' };
	}

	if (tempUser.token !== token) {
		return { success: false, error: 'Invalid token' };
	}

	return { success: true };
}

type CreateUserFromTempUserResponse =
	| {
			success: true;
	  }
	| {
			success: false;
			error: string;
	  };

export async function createUserFromTempUser(
	db: DB,
	tempUser: TempUser
): Promise<CreateUserFromTempUserResponse> {
	try {
		await db.batch([
			db.delete(tempUsers).where(eq(tempUsers.id, tempUser.id)),
			db.insert(users).values({
				id: tempUser.id,
				email: tempUser.email,
				passwordHash: tempUser.passwordHash,
			}),
			db.insert(userStorageMetrics).values({
				userId: tempUser.id,
			}),
		]);
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
	}
}
