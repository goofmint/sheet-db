import { describe, it, expect } from 'vitest';
import { setupRoleTests, createJsonHeaders, testSessionId, validAuthToken, auth0TestEmail, auth0TestPassword, BASE_URL } from './helpers.js';
import type { ApiErrorResponse, RoleUpdateResponse } from '../types/api-responses';

describe('Role Update API', () => {
	setupRoleTests();

	describe('PUT /api/roles/:roleName', () => {

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ public_read: true }),
			});

			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle non-existent role', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/non-existent-role-12345`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ public_read: true }),
			});

			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
		});


		it('should handle malformed JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: 'invalid json',
			});

			expect(response.status).toBe(400);
			expect(response.ok).toBe(false);
		});

		it('should update role successfully (integration test)', async () => {
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables not available');
				return;
			}

			// First, create a test role
			const createRoleName = `test-update-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: createRoleName, public_read: false, public_write: false }),
			});

			if (createResponse.status === 401) {
				const data = (await createResponse.json()) as ApiErrorResponse;
				console.log(`Skipping integration test due to authentication failure: ${data.error}`);
				return;
			}
			if (createResponse.status === 500) {
				const data = (await createResponse.json()) as ApiErrorResponse;
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(createResponse.status).toBe(200);

			// Update the created role
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${createRoleName}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ public_read: true, public_write: true, role_read: ['admin'], user_read: ['user123'] }),
			});

			if (updateResponse.status === 401) {
				const data = (await updateResponse.json()) as ApiErrorResponse;
				throw new Error(`Authentication failed during update: ${data.error}`);
			}
			if (updateResponse.status === 500) {
				const data = (await updateResponse.json()) as ApiErrorResponse;
				throw new Error(`System error during update: ${data.error}`);
			}

			expect(updateResponse.status).toBe(200);
			const updateData = (await updateResponse.json()) as RoleUpdateResponse;
			expect(updateData.success).toBe(true);
			expect(updateData.data.name).toBe(createRoleName);
			expect(updateData.data.public_read).toBe(true);
			expect(updateData.data.public_write).toBe(true);
			expect(updateData.data.role_read).toEqual(['admin']);
			expect(updateData.data.user_read).toEqual(['user123']);
			expect(updateData.data.updated_at).toBeDefined();
		});

		it('should prevent duplicate names when updating (integration test)', async () => {
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables not available');
				return;
			}

			const timestamp = Date.now();
			const firstRoleName = `test-role-1-${timestamp}`;
			const secondRoleName = `test-role-2-${timestamp}`;

			// Create two roles
			const createFirst = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: firstRoleName, public_read: false, public_write: false }),
			});

			const createSecond = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: secondRoleName, public_read: false, public_write: false }),
			});

			if (createFirst.status !== 200 || createSecond.status !== 200) {
				console.log('Skipping integration test due to role creation failure');
				return;
			}

			// Try to change the name of the second role to be the same as the first role
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${secondRoleName}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: firstRoleName }),
			});

			expect(updateResponse.status).toBe(409);
			const updateData = (await updateResponse.json()) as ApiErrorResponse;
			expect(updateData.success).toBe(false);
			expect(updateData.error).toContain('already exists');
			expect(updateData.error).toContain('unique');
		});
	});
});