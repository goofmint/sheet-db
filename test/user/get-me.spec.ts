import { describe, it, expect, beforeAll } from 'vitest';
import { setupUserAuth, createAuthHeaders, BASE_URL, type Bindings } from './helpers';
import { SELF, env } from 'cloudflare:test';

describe('User API - GET /api/users/me', () => {
	let sessionId: string;
	let userInfo: { sub: string; email: string };

	beforeAll(async () => {
		const auth = await setupUserAuth();
		sessionId = auth.sessionId;
		userInfo = auth.userInfo;
	}, 30000);

	describe('Authentication success', () => {
		it('should return user information for authenticated user', async () => {
			const response = await fetch(`${BASE_URL}/api/users/me`, {
				method: 'GET',
				headers: createAuthHeaders(sessionId)
			});

			const data = await response.json() as any;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('id');
			expect(data.data).toHaveProperty('email', userInfo.email);
		});
	});

	describe('Authentication failure', () => {
		it('should return 401 for unauthenticated request', async () => {
			const response = await fetch(`${BASE_URL}/api/users/me`, {
				method: 'GET',
				headers: createAuthHeaders('invalid_session_id')
			});

			const data = await response.json() as any;

			expect(response.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return 400 for missing authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/users/me`, {
				method: 'GET'
			});

			expect(response.status).toBe(400);
		});
	});
});