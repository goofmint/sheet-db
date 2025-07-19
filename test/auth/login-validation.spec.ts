import { describe, it, expect } from 'vitest';
import { setupAuthTests, createJsonHeaders, BASE_URL, type ApiErrorResponse } from './helpers';

setupAuthTests();

describe('POST /api/login - Validation', () => {
	it('should reject requests with missing token', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				userInfo: {
					sub: 'auth0|test123',
					email: 'test@example.com'
				}
			})
		});

		expect(response.status).toBe(400);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should reject requests with missing userInfo', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: 'test-token'
			})
		});

		expect(response.status).toBe(400);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should reject requests with invalid userInfo structure', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: 'test-token',
				userInfo: {
					// Missing required sub field
					email: 'test@example.com'
				}
			})
		});

		expect(response.status).toBe(400);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should reject requests with invalid Auth0 token', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: 'invalid-auth0-token',
				userInfo: {
					sub: 'auth0|test123',
					email: 'test@example.com',
					name: 'Test User'
				}
			})
		});

		expect(response.status).toBe(401);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
		expect(data.error).toContain('token');
	});

	it('should validate email format in userInfo', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: 'test-token',
				userInfo: {
					sub: 'auth0|test123',
					email: 'invalid-email-format'
				}
			})
		});

		expect(response.status).toBe(400);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should handle malformed JSON requests', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: '{invalid json}'
		});

		expect([400, 422].includes(response.status)).toBe(true);
	});

	it('should handle requests without Content-Type header', async () => {
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			body: JSON.stringify({
				token: 'test-token',
				userInfo: {
					sub: 'auth0|test123',
					email: 'test@example.com'
				}
			})
		});

		// Different servers handle missing Content-Type differently
		// Accept any error status as long as it's not 200
		expect(response.status).not.toBe(200);
	});
});