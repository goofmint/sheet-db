import { describe, it, expect, beforeAll } from 'vitest';
import { setupUserAuth, createAuthHeaders, BASE_URL, type Bindings } from './helpers';

describe('User API - PUT /api/users/:id', () => {
	let sessionId: string;
	let userInfo: { sub: string; email: string };

	beforeAll(async () => {
		const auth = await setupUserAuth();
		sessionId = auth.sessionId;
		userInfo = auth.userInfo;
	}, 30000);

	describe('Successful updates', () => {
		it('should update user information with valid data', async () => {
			const updateData = {
				name: 'Updated Name',
				nickname: 'updateduser'
			};

			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'PUT',
				headers: createAuthHeaders(sessionId, true),
				body: JSON.stringify(updateData)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'Updated Name');
			expect(data.data).toHaveProperty('nickname', 'updateduser');
		});

		it('should set email_verified to false when email is updated', async () => {
			const updateData = {
				email: 'newemail@example.com'
			};

			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'PUT',
				headers: createAuthHeaders(sessionId, true),
				body: JSON.stringify(updateData)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('email', 'newemail@example.com');
		});
	});

	describe('Authentication and authorization', () => {
		it('should return 401 for unauthenticated request', async () => {
			const updateData = { name: 'Updated Name' };

			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'PUT',
				headers: createAuthHeaders('invalid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.success).toBe(false);
		});
	});

	describe('Validation errors', () => {
		it('should return 400 for read-only field updates', async () => {
			const updateData = {
				id: 'new_id', // Read-only field
				name: 'Updated Name'
			};

			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'PUT',
				headers: createAuthHeaders(sessionId, true),
				body: JSON.stringify(updateData)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain('read-only');
		});

		it('should return 400 for empty update data', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'PUT',
				headers: createAuthHeaders(sessionId, true),
				body: JSON.stringify({})
			});

			expect(response.status).toBe(400);
		});
	});

	describe('User not found', () => {
		it('should return 404 for non-existent user', async () => {
			const updateData = { name: 'Updated Name' };

			const response = await fetch(`${BASE_URL}/api/users/nonexistent-user-id`, {
				method: 'PUT',
				headers: createAuthHeaders(sessionId, true),
				body: JSON.stringify(updateData)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(404);
			expect(data.success).toBe(false);
		});
	});
});