import { describe, it, expect, beforeAll } from 'vitest';
import { setupAllMocks, createUserApp, mockEnv, createAuthHeaders, type Bindings } from './helpers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('User API - GET /api/users/me', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		setupAllMocks();
		app = await createUserApp();
	});

	describe('Authentication success', () => {
		it('should return user information for authenticated user', async () => {
			const req = new Request('http://localhost/api/users/me', {
				method: 'GET',
				headers: createAuthHeaders('valid_session_id')
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('id', 'user123');
			expect(data.data).toHaveProperty('email', 'user@example.com');
			expect(data.data).toHaveProperty('name', 'Test User');
		});
	});

	describe('Authentication failure', () => {
		it('should return 401 for unauthenticated request', async () => {
			const req = new Request('http://localhost/api/users/me', {
				method: 'GET',
				headers: createAuthHeaders('invalid_session_id')
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return 400 for missing authorization header', async () => {
			const req = new Request('http://localhost/api/users/me', {
				method: 'GET'
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400); // Invalid header format
		});
	});
});