import { describe, it, expect } from 'vitest';
import { setupRoleTests, createJsonHeaders, testSessionId, validAuthToken, auth0TestEmail, auth0TestPassword, BASE_URL } from './helpers.js';
import type { ApiErrorResponse, RoleCreateResponse } from '../types/api-responses';

describe('Role Create API', () => {
	setupRoleTests();

	describe('POST /api/roles', () => {

		it('should require name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ public_read: true }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject empty name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: '' }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject whitespace-only name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: '   ' }),
			});

			expect([400, 401].includes(response.status)).toBe(true);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});


		it('should handle malformed JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: 'invalid json',
			});

			expect(response.status).toBe(400);
			expect(response.ok).toBe(false);
		});

		it('should create role with valid session (integration test)', async () => {

			const uniqueRoleName = `test-role-${Date.now()}`;
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: uniqueRoleName, public_read: true, public_write: false }),
			});

			if (response.status === 401) {
				const data = (await response.json()) as ApiErrorResponse;
				throw new Error(`Authentication failed: ${data.error}`);
			}
			if (response.status === 500) {
				const data = (await response.json()) as ApiErrorResponse;
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(response.status).toBe(200);
			const data = (await response.json()) as RoleCreateResponse;
			expect(data.success).toBe(true);
			expect(data.data.name).toBe(uniqueRoleName);
			expect(data.data.public_read).toBe(true);
			expect(data.data.public_write).toBe(false);
			expect(data.data.created_at).toBeDefined();
			expect(data.data.updated_at).toBeDefined();
		});

		it('should prevent duplicate role names (integration test)', async () => {

			const duplicateRoleName = `duplicate-role-${Date.now()}`;

			// Create the first role
			const firstResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: duplicateRoleName, public_read: false, public_write: false }),
			});

			if (firstResponse.status === 401) {
				const data = (await firstResponse.json()) as ApiErrorResponse;
				throw new Error(`Authentication failed: ${data.error}`);
			}
			if (firstResponse.status === 500) {
				const data = (await firstResponse.json()) as ApiErrorResponse;
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(firstResponse.status).toBe(200);

			// Try to create again with the same name
			const secondResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: duplicateRoleName, public_read: true, public_write: true }),
			});

			expect(secondResponse.status).toBe(409);
			const secondData = (await secondResponse.json()) as ApiErrorResponse;
			expect(secondData.success).toBe(false);
			expect(secondData.error).toContain('already exists');
			expect(secondData.error).toContain('unique');
		});
	});
});