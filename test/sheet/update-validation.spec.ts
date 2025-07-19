import { describe, it, expect, beforeAll } from 'vitest';
import { setupAllMocks, createUpdateApp, mockEnv, createAuthHeaders, vi, type Bindings } from './update-helpers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('Sheet Update API - Validation', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		setupAllMocks();
		app = await createUpdateApp();
	}, 30000);

	describe('PUT /api/sheets/:id - Validation Tests', () => {
		it('should return 400 for empty update data', async () => {
			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify({})
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400); // Should fail validation for empty update data
		});

		it('should return 404 for non-existent sheet', async () => {
			// Mock fetch to return empty metadata for non-existent sheet
			const originalFetch = globalThis.fetch;
			globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const urlStr = input.toString();
				
				if (urlStr.includes('/spreadsheets/') && !urlStr.includes('/values/')) {
					return new Response(JSON.stringify({ sheets: [] }), { status: 200 });
				}
				
				return originalFetch(input, init);
			});

			const updateData = {
				name: 'UpdatedName'
			};

			const req = new Request('http://localhost/api/sheets/99999', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(404);
			expect(data.success).toBe(false);
			expect(data.error).toContain('not found');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should handle malformed JSON', async () => {
			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: 'invalid-json'
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400);
		});

		it('should validate sheet name constraints', async () => {
			const updateData = {
				name: '' // Empty name should fail validation
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400);
		});

		it('should validate permission arrays', async () => {
			const updateData = {
				role_read: 'invalid-not-array' // Should be array
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400);
		});

		it('should validate boolean permission fields', async () => {
			const updateData = {
				public_read: 'invalid-not-boolean' // Should be boolean
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400);
		});
	});
});