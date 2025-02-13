import { User } from '@/db/schema';
import { env, SELF } from 'cloudflare:test';
import { createTestUsers, loginTestUser } from 'test/integration/utils';
import { beforeEach, describe, expect, it } from 'vitest';

let cookie: string;
let user: User;
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
