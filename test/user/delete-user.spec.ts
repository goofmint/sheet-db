import { describe, it, expect, beforeAll } from 'vitest';
import { setupUserAuth, createAuthHeaders, BASE_URL, type Bindings } from './helpers';

describe('User API - DELETE /api/users/:id', () => {
	let sessionId: string;
	let userInfo: { sub: string; email: string };

	beforeAll(async () => {
		const auth = await setupUserAuth();
		sessionId = auth.sessionId;
		userInfo = auth.userInfo;
	}, 30000);

	describe('Successful deletion', () => {
		it('should delete user data with valid permissions', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'DELETE',
				headers: createAuthHeaders(sessionId)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.message).toContain('successfully deleted');
		});
	});

	describe('Authentication and authorization', () => {
		it('should return 401 for unauthenticated request', async () => {
			const response = await fetch(`${BASE_URL}/api/users/${userInfo.sub}`, {
				method: 'DELETE',
				headers: createAuthHeaders('invalid_session_id')
			});

			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.success).toBe(false);
		});

		it('should return 403 for insufficient permissions', async () => {
			const response = await fetch(`${BASE_URL}/api/users/other_user_id`, {
				method: 'DELETE',
				headers: createAuthHeaders(sessionId)
			});

			const data = await response.json() as any;

			// Should return 403 when trying to delete another user without admin permissions
			expect(response.status).toBe(403);
			expect(data.success).toBe(false);
		});
	});

	describe('User not found', () => {
		it('should return 404 for non-existent user', async () => {
			const response = await fetch(`${BASE_URL}/api/users/nonexistent-user-id`, {
				method: 'DELETE',
				headers: createAuthHeaders(sessionId)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(404);
			expect(data.success).toBe(false);
		});
	});
});