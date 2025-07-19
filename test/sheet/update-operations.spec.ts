import { describe, it, expect, beforeAll } from 'vitest';
import { setupAllMocks, createUpdateApp, mockEnv, createAuthHeaders, type Bindings } from './update-helpers';
import { OpenAPIHono } from '@hono/zod-openapi';

describe('Sheet Update API - Operations', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		setupAllMocks();
		app = await createUpdateApp();
	}, 30000);

	describe('PUT /api/sheets/:id - Basic Operations', () => {
		it('should update sheet name successfully', async () => {
			const updateData = {
				name: 'UpdatedSheetName'
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
			expect(data.data).toHaveProperty('name', 'UpdatedSheetName');
			expect(data.data).toHaveProperty('sheetId', 12345);
			expect(data.data.message).toContain('updated successfully');
		});

		it('should update permissions successfully', async () => {
			const updateData = {
				public_read: false,
				public_write: true,
				role_read: ['viewer'],
				role_write: ['editor'],
				user_read: ['user456'],
				user_write: ['user789']
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
			expect(data.data).toHaveProperty('public_read', false);
			expect(data.data).toHaveProperty('public_write', true);
			expect(data.data).toHaveProperty('role_read', ['viewer']);
			expect(data.data).toHaveProperty('role_write', ['editor']);
			expect(data.data).toHaveProperty('user_read', ['user456']);
			expect(data.data).toHaveProperty('user_write', ['user789']);
		});

		it('should update name and permissions together', async () => {
			const updateData = {
				name: 'NewSheetName',
				public_read: true,
				public_write: false,
				role_write: ['admin']
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
			expect(data.data).toHaveProperty('name', 'NewSheetName');
			expect(data.data).toHaveProperty('public_read', true);
			expect(data.data).toHaveProperty('public_write', false);
			expect(data.data).toHaveProperty('role_write', ['admin']);
		});
	});
});