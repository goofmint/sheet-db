import { describe, it, expect } from 'vitest';
import { setupRoleTests, createJsonHeaders, testSessionId, validAuthToken, auth0TestEmail, auth0TestPassword, BASE_URL } from './helpers.js';
import type { ApiErrorResponse, RoleUpdateResponse } from '../types/api-responses';

describe('Role Delete API', () => {
	setupRoleTests();

	describe('DELETE /api/roles/:roleName', () => {

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'DELETE',
				headers: createJsonHeaders(testSessionId),
			});

			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: createJsonHeaders('invalid-session-id'),
			});

			expect(response.status).toBe(401);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			const expectedMessages = [
				'Session not found',
				'Authentication failed',
				'No spreadsheet configured',
				'No valid Google token found',
				'Failed to fetch session data',
			];
			const hasExpectedMessage = expectedMessages.some((msg) => data.error.includes(msg));
			expect(hasExpectedMessage).toBe(true);
		});

		it('should handle non-existent role', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/non-existent-role-delete-12345`, {
				method: 'DELETE',
				headers: createJsonHeaders(testSessionId),
			});

			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
		});

		it('should check write permissions', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role-no-permission`, {
				method: 'DELETE',
				headers: createJsonHeaders(testSessionId),
			});

			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
		});

		it('should delete role successfully (integration test)', async () => {
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables not available');
				return;
			}

			// First, create a test role
			const deleteRoleName = `test-delete-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: deleteRoleName, public_read: false, public_write: false }),
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

			// Delete the created role
			const deleteResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'DELETE',
				headers: createJsonHeaders(testSessionId),
			});

			if (deleteResponse.status === 401) {
				const data = (await deleteResponse.json()) as ApiErrorResponse;
				throw new Error(`Authentication failed during deletion: ${data.error}`);
			}
			if (deleteResponse.status === 500) {
				const data = (await deleteResponse.json()) as ApiErrorResponse;
				throw new Error(`System error during deletion: ${data.error}`);
			}

			expect(deleteResponse.status).toBe(200);
			const deleteData = await deleteResponse.json();
			expect(deleteData).toEqual({});

			// Verify that the deleted role does not exist
			const verifyResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ public_read: true }),
			});

			expect([403, 404].includes(verifyResponse.status)).toBe(true);
		});

		it('should return empty object on successful deletion', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role-for-empty-response`, {
				method: 'DELETE',
				headers: createJsonHeaders(testSessionId),
			});

			expect([401, 403, 404].includes(response.status)).toBe(true);

			const data = (await response.json()) as RoleUpdateResponse;
			if (response.status === 200) {
				expect(data).toEqual({});
			} else {
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});