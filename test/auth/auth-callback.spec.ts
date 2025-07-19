import { describe, it, expect } from 'vitest';
import { 
	setupAuthTests, 
	BASE_URL,
	createJsonHeaders,
	type ApiErrorResponse 
} from './helpers';

describe('Authentication API - Callback Tests', () => {
	setupAuthTests();

	describe('GET /api/auth/callback', () => {
		it('should redirect to GET /api/auth', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toBe(`${BASE_URL}/api/auth`);
		});

		it('should preserve query parameters in redirect', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback?code=test123&state=xyz`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toBe(`${BASE_URL}/api/auth?code=test123&state=xyz`);
		});
	});

	describe('POST /api/auth/callback', () => {
		it('should handle POST requests and return error', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback`, {
				method: 'POST',
				headers: createJsonHeaders(null),
				body: JSON.stringify({
					code: 'test-code'
				})
			});

			// POSTメソッドでも認証コードの交換を試みる
			expect(response.status).toBe(400);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Failed to exchange authorization code');
		});
	});
});