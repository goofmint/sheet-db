import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { setupAllMocks, createUserApp, mockEnv, createAuthHeaders, mockFetchForNonExistentUser, type Bindings } from './helpers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('User API - PUT /api/users/:id', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		setupAllMocks();
		app = await createUserApp();
	});

	afterEach(() => {
		// Restore any mocked fetch functions
		if (globalThis.fetch?.mockRestore) {
			globalThis.fetch.mockRestore();
		}
	});

	describe('Successful updates', () => {
		it('should update user information with valid data', async () => {
			const updateData = {
				name: 'Updated Name',
				nickname: 'updateduser'
			};

			const req = new Request('http://localhost/api/users/user123', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'Updated Name');
			expect(data.data).toHaveProperty('nickname', 'updateduser');
		});

		it('should set email_verified to false when email is updated', async () => {
			const updateData = {
				email: 'newemail@example.com'
			};

			const req = new Request('http://localhost/api/users/user123', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('email', 'newemail@example.com');
			expect(data.data.email_verified).toBeUndefined(); // Should be false, which becomes undefined in response
		});
	});

	describe('Authentication and authorization', () => {
		it('should return 401 for unauthenticated request', async () => {
			const updateData = { name: 'Updated Name' };

			const req = new Request('http://localhost/api/users/user123', {
				method: 'PUT',
				headers: createAuthHeaders('invalid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
		});
	});

	describe('Validation errors', () => {
		it('should return 400 for read-only field updates', async () => {
			const updateData = {
				id: 'new_id', // Read-only field
				name: 'Updated Name'
			};

			const req = new Request('http://localhost/api/users/user123', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(400);
			expect(data.success).toBe(false);
			expect(data.error).toContain('read-only');
		});

		it('should return 400 for empty update data', async () => {
			const req = new Request('http://localhost/api/users/user123', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id', true),
				body: JSON.stringify({})
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400); // Validation should fail for empty update data
		});
	});

	describe('User not found', () => {
		it('should return 404 for non-existent user', async () => {
			const originalFetch = mockFetchForNonExistentUser();

			const updateData = { name: 'Updated Name' };

			const req = new Request('http://localhost/api/users/nonexistent', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id', true),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(404);
			expect(data.success).toBe(false);

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});
	});
});