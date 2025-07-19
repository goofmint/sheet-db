import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { setupAllMocks, createUpdateApp, mockEnv, createAuthHeaders, setupCustomFetchMock, type Bindings } from './update-helpers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('Sheet Update API - Permissions', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		setupAllMocks();
		app = await createUpdateApp();
	}, 30000);

	afterEach(() => {
		// Reset fetch mock to default after each test
		if (globalThis.fetch?.mockRestore) {
			globalThis.fetch.mockRestore();
		}
	});

	describe('PUT /api/sheets/:id - Permission Tests', () => {
		it('should allow update when user has write permission', async () => {
			const mockSheetDataWithPermissions = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'false', '[]', '[]', '[]', '["user123"]']
				]
			};

			const originalFetch = setupCustomFetchMock(mockSheetDataWithPermissions);

			const updateData = {
				name: 'UpdatedByUser'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'UpdatedByUser');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should deny update when user has no write permission', async () => {
			const mockSheetDataNoPermissions = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'true', 'false', '[]', '[]', '[]', '["other_user"]']
				]
			};

			const originalFetch = setupCustomFetchMock(mockSheetDataNoPermissions);

			const updateData = {
				name: 'ShouldNotUpdate'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(403);
			expect(data.success).toBe(false);
			expect(data.error).toContain('No write permission');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should allow update when public_write is true', async () => {
			const mockSheetDataPublicWrite = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'true', '[]', '[]', '[]', '[]']
				]
			};

			const originalFetch = setupCustomFetchMock(mockSheetDataPublicWrite);

			const updateData = {
				name: 'PublicUpdateSheet'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'PublicUpdateSheet');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should allow update when user has required role', async () => {
			const mockSheetDataRoleWrite = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'false', '[]', '["admin"]', '[]', '[]']
				]
			};

			const originalFetch = setupCustomFetchMock(mockSheetDataRoleWrite);

			const updateData = {
				name: 'RoleUpdateSheet'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('valid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'RoleUpdateSheet');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should return 401 for unauthenticated request', async () => {
			const updateData = {
				name: 'UpdatedName'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: createAuthHeaders('invalid_session_id'),
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});