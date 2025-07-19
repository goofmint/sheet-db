import { describe, it, expect } from 'vitest';
import { setupRoleTests, createJsonHeaders, testSessionId, BASE_URL } from './helpers.js';
import type { ApiErrorResponse } from '../types/api-responses';

describe('Role Validation API', () => {
	setupRoleTests();

	describe('Role permission validation', () => {
		it('should validate role name type in create', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 123 }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject invalid name type in update', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 123 }),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject empty name in update', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: '' }),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject empty update body', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({}),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
		it('should test valid boolean fields', async () => {
			const booleanTests = [
				{ field: 'public_read', value: true },
				{ field: 'public_read', value: false },
				{ field: 'public_write', value: true },
				{ field: 'public_write', value: false },
			];

			for (const test of booleanTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [test.field]: test.value }),
				});
				// These are valid field updates, should succeed (200) or indicate permission/not found issues (401/403/404)
				console.log(`Boolean test ${test.field}=${test.value}: status ${response.status}`);
				expect([200, 401, 403, 404].includes(response.status)).toBe(true);
				const data = (await response.json());
				if (response.status === 200) {
					expect(data.success).toBe(true);
				} else {
					expect(data.success).toBe(false);
				}
			}
		}, 30000);

		it('should test valid array fields', async () => {
			const arrayTests = [
				{ field: 'role_read', value: ['admin', 'user'] },
				{ field: 'role_write', value: [] },
				{ field: 'user_read', value: ['user123', 'user456'] },
				{ field: 'user_write', value: ['user789'] },
				{ field: 'users', value: ['user1', 'user2', 'user3'] },
				{ field: 'roles', value: ['parent-role'] },
			];

			for (const test of arrayTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [test.field]: test.value }),
				});
				// These are valid field updates, should succeed (200) or indicate permission/not found issues (401/403/404)
				console.log(`Array test ${test.field}=${JSON.stringify(test.value)}: status ${response.status}`);
				expect([200, 401, 403, 404].includes(response.status)).toBe(true);
				const data = (await response.json());
				if (response.status === 200) {
					expect(data.success).toBe(true);
				} else {
					expect(data.success).toBe(false);
				}
			}
		}, 30000);

		it('should reject invalid array fields', async () => {
			const invalidArrayTests = [
				{ field: 'role_read', value: 'not-an-array' },
				{ field: 'role_write', value: 123 },
				{ field: 'user_read', value: { invalid: 'object' } },
				{ field: 'user_write', value: 'string' },
				{ field: 'users', value: null },
				{ field: 'roles', value: false },
			];

			for (const test of invalidArrayTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [test.field]: test.value }),
				});
				expect([400, 401, 403].includes(response.status)).toBe(true);
				const data = (await response.json()) as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should reject invalid boolean fields', async () => {
			const invalidBooleanTests = [
				{ field: 'public_read', value: 'not-a-boolean' },
				{ field: 'public_write', value: 123 },
				{ field: 'public_read', value: null },
				{ field: 'public_write', value: { invalid: 'object' } },
			];

			for (const test of invalidBooleanTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [test.field]: test.value }),
				});
				expect([400, 401, 403].includes(response.status)).toBe(true);
				const data = (await response.json()) as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});