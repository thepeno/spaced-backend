import * as schema from '@/db/schema';
import { User } from '@/db/schema';
import { env, SELF } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { createTestUsers, loginTestUser } from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';
let cookie: string;
let user: User;

const db = drizzle(env.D1, {
	schema,
});

beforeEach(async () => {
	user = await createTestUsers();
	const { cookie: cookieFromLogin } = await loginTestUser();
	cookie = cookieFromLogin;
});

describe('upload', () => {
	it('should upload a file', async () => {
		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(200);
		const data = (await response.json()) as { success: boolean; fileKey: string };
		expect(data).toMatchObject({
			success: true,
			fileKey: expect.any(String),
		});
		const fileKey = data.fileKey;
		const file = await env.FILES_BUCKET.get(fileKey);
		expect(file).toBeDefined();
		expect(file?.body).toBeDefined();

		const response2 = new Response(file?.body);
		const text = await response2.text();
		expect(text).toBe('test');
	});

	it('should return 400 if no file is uploaded', async () => {
		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
		});

		expect(response.status).toBe(400);
	});

	it('should return 400 if file is a string', async () => {
		const formData = new FormData();
		formData.append('file', 'test');
		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(400);
	});

	it('should return 400 if file type is invalid', async () => {
		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.txt', { type: 'text/plain' }));
		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(400);
	});

	it('should return 413 if file is too large', async () => {
		const formData = new FormData();
		const testString = 'a'.repeat(2 * 1024 * 1024 + 1);

		formData.append('file', new File([testString], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(413);
	});

	it('should update the user storage metrics', async () => {
		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(200);
		await response.json();

		const userStorageMetrics = await db.query.userStorageMetrics.findFirst({
			where: eq(schema.userStorageMetrics.userId, user.id),
		});
		expect(userStorageMetrics).toMatchObject({
			totalSizeInBytes: 4,
		});
	});

	it('should increase from existing metrics', async () => {
		await db
			.update(schema.userStorageMetrics)
			.set({
				totalSizeInBytes: 100,
			})
			.where(eq(schema.userStorageMetrics.userId, user.id));

		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(200);
		await response.json();

		const userStorageMetrics = await db.query.userStorageMetrics.findFirst({
			where: eq(schema.userStorageMetrics.userId, user.id),
		});
		expect(userStorageMetrics).toMatchObject({
			totalSizeInBytes: 104,
		});
	});

	it('should throw if exceeds the storage limit', async () => {
		await db
			.update(schema.userStorageMetrics)
			.set({
				storageLimitInBytes: 1,
			})
			.where(eq(schema.userStorageMetrics.userId, user.id));

		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(413);
		const data = await response.json();
		expect(data).toMatchObject({
			success: false,
			error: 'Storage limit exceeded',
		});

		const allObjects = await env.FILES_BUCKET.list();
		expect(allObjects.objects.length).toBe(0);
	});

	it.only('should return the same key if a duplicate file is uploaded', async () => {
		const formData = new FormData();
		formData.append('file', new File(['test'], 'test.png', { type: 'image/png' }));

		const response = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response.status).toBe(200);
		const data = await response.json();
		expect(data).toMatchObject({
			success: true,
			fileKey: expect.any(String),
		});
		const fileKey = (data as { fileKey: string }).fileKey;

		// Check that the file exists in the db
		const file = await db.query.files.findFirst({
			where: eq(schema.files.id, fileKey.split('/')[1]),
		});
		expect(file).toMatchObject({
			checksum: expect.any(String),
		});

		const response2 = await SELF.fetch('http://localhost:3000/api/upload', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
			body: formData,
		});

		expect(response2.status).toBe(200);
		const data2 = await response2.json();
		expect(data2).toMatchObject({
			success: true,
			fileKey: expect.any(String),
		});
		expect((data2 as { fileKey: string }).fileKey).toBe(fileKey);
	});
});

describe('files', () => {
	it('should return 404 if no file key is provided', async () => {
		const response = await SELF.fetch('http://localhost:3000/api/files', {
			method: 'GET',
			headers: {
				Cookie: cookie,
			},
		});

		expect(response.status).toBe(404);
	});

	it('should return 403 if file is not for user', async () => {
		const response = await SELF.fetch('http://localhost:3000/api/files/test-user/test-file', {
			method: 'GET',
			headers: {
				Cookie: cookie,
			},
		});

		expect(response.status).toBe(403);
	});

	it('should return 404 if file is not found', async () => {
		const response = await SELF.fetch(`http://localhost:3000/api/files/${user.id}/test-file`, {
			method: 'GET',
			headers: {
				Cookie: cookie,
			},
		});

		expect(response.status).toBe(404);
	});

	it('should return 200 if file is found', async () => {
		const testFile = new File(['test'], 'test.png', { type: 'image/png' });
		await env.FILES_BUCKET.put(`${user.id}/test-file`, testFile);

		const response = await SELF.fetch(`http://localhost:3000/api/files/${user.id}/test-file`, {
			method: 'GET',
			headers: {
				Cookie: cookie,
			},
		});

		expect(response.status).toBe(200);
		const file = await response.text();
		expect(file).toBe('test');
	});
});
