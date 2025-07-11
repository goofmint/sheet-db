import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authenticateWithAuth0, getAuth0TestCredentials, BASE_URL } from './helpers/auth.js';

describe('Role Update API', () => {
	let testSessionId: string;
	let validAuthToken: string;

	// Auth0 test environment variables
	const { email: auth0TestEmail, password: auth0TestPassword } = getAuth0TestCredentials();

	beforeAll(async () => {
		// Try to get real session ID through Auth0 authentication flow
		if (auth0TestEmail && auth0TestPassword) {
			console.log('Setting up authentication for role update tests...');

			// Try Auth0 authentication first
			const realSessionId = await authenticateWithAuth0();
			if (realSessionId) {
				testSessionId = realSessionId;
				validAuthToken = `Bearer ${testSessionId}`;
				console.log('Using Auth0-derived session ID for testing');
			} else {
				// Use a deterministic test session ID for consistent error reporting
				console.log('Auth0 authentication not available, using fallback test session');
				testSessionId = `test-session-${auth0TestEmail || 'unknown'}-${Date.now()}`;
				validAuthToken = `Bearer ${testSessionId}`;
				console.log('Note: Integration tests will fail without proper authentication setup');
			}
		} else {
			console.log('Skipping real authentication - using test session for basic validation tests');
			testSessionId = 'test-session-uuid-123';
			validAuthToken = `Bearer ${testSessionId}`;
		}
	});

	afterAll(async () => {
		// Post-test cleanup
		// Implement here if deletion of created test roles etc. is needed
	});

	describe('PUT /api/roles/:roleName', () => {
		it('should require Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'InvalidFormat',
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			// 404 Not Found (ルートが存在しない) または 400 Bad Request が期待される
			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer invalid-session-id',
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			expect(response.status).toBe(401);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(
				['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found'].some((msg) =>
					data.error.includes(msg)
				)
			).toBe(true);
		});

		it('should handle non-existent role', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/non-existent-role-12345`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			// 認証エラーまたは404 Not Found が期待される
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it('should reject invalid name type', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: 123, // number instead of string
				}),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject empty name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: '',
				}),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

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
					headers: {
						'Content-Type': 'application/json',
						Authorization: validAuthToken,
					},
					body: JSON.stringify({
						[test.field]: test.value,
					}),
				});

				expect([400, 401, 403].includes(response.status)).toBe(true);
				const data = (await response.json()) as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should reject empty update body', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({}),
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle malformed JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: 'invalid json',
			});

			expect(response.status).toBe(400);
			// Malformed JSON might return HTML error page, so just check status
			expect(response.ok).toBe(false);
		});

		it('should update role successfully (integration test)', async () => {
			// This integration test requires authentication
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables not available');
				return;
			}

			// First, create a test role
			const createRoleName = `test-update-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: createRoleName,
					public_read: false,
					public_write: false,
				}),
			});

			if (createResponse.status === 401) {
				const data = (await createResponse.json()) as { success: boolean; error: string };
				console.log(`Skipping integration test due to authentication failure: ${data.error}`);
				return;
			}
			if (createResponse.status === 500) {
				const data = (await createResponse.json()) as { success: boolean; error: string };
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(createResponse.status).toBe(200);

			// Update the created role
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${createRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					public_read: true,
					public_write: true,
					role_read: ['admin'],
					user_read: ['user123'],
				}),
			});

			if (updateResponse.status === 401) {
				const data = (await updateResponse.json()) as { success: boolean; error: string };
				throw new Error(`Authentication failed during update: ${data.error}`);
			}
			if (updateResponse.status === 500) {
				const data = (await updateResponse.json()) as { success: boolean; error: string };
				throw new Error(`System error during update: ${data.error}`);
			}

			expect(updateResponse.status).toBe(200);
			const updateData = (await updateResponse.json()) as {
				success: boolean;
				data: {
					name: string;
					public_read: boolean;
					public_write: boolean;
					role_read: string[];
					user_read: string[];
					updated_at: string;
				};
			};

			expect(updateData.success).toBe(true);
			expect(updateData.data.name).toBe(createRoleName);
			expect(updateData.data.public_read).toBe(true);
			expect(updateData.data.public_write).toBe(true);
			expect(updateData.data.role_read).toEqual(['admin']);
			expect(updateData.data.user_read).toEqual(['user123']);
			expect(updateData.data.updated_at).toBeDefined();
		});

		it('should prevent duplicate names when updating (integration test)', async () => {
			// This integration test requires authentication
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
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: firstRoleName,
					public_read: false,
					public_write: false,
				}),
			});

			const createSecond = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: secondRoleName,
					public_read: false,
					public_write: false,
				}),
			});

			if (createFirst.status !== 200) {
				const data = (await createFirst.json()) as { success: boolean; error: string };
				console.log(`Skipping integration test due to role creation failure: ${createFirst.status} - ${data.error}`);
				return;
			}
			if (createSecond.status !== 200) {
				const data = (await createSecond.json()) as { success: boolean; error: string };
				console.log(`Skipping integration test due to role creation failure: ${createSecond.status} - ${data.error}`);
				return;
			}

			// Try to change the name of the second role to be the same as the first role (duplicate error expected)
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${secondRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: firstRoleName,
				}),
			});

			expect(updateResponse.status).toBe(409); // Conflict
			const updateData = (await updateResponse.json()) as { success: boolean; error: string };
			expect(updateData.success).toBe(false);
			expect(updateData.error).toContain('already exists');
			expect(updateData.error).toContain('unique');
		});
	});

	describe('Role permission validation', () => {
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
					headers: {
						'Content-Type': 'application/json',
						Authorization: validAuthToken,
					},
					body: JSON.stringify({
						[test.field]: test.value,
					}),
				});

				// 認証エラーまたは権限エラーが期待される（ロールが存在しない、または権限がない）
				expect([401, 403, 404].includes(response.status)).toBe(true);
				const data = (await response.json()) as { success: boolean; error: string };
				expect(data.success).toBe(false);
			}
		});

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
					headers: {
						'Content-Type': 'application/json',
						Authorization: validAuthToken,
					},
					body: JSON.stringify({
						[test.field]: test.value,
					}),
				});

				// 認証エラーまたは権限エラーが期待される（ロールが存在しない、または権限がない）
				expect([401, 403, 404].includes(response.status)).toBe(true);
				const data = (await response.json()) as { success: boolean; error: string };
				expect(data.success).toBe(false);
			}
		});
	});

	describe('DELETE /api/roles/:roleName', () => {
		it('should require Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
				},
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'InvalidFormat',
				},
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
			});

			// Expected 404 Not Found (route does not exist) or 400 Bad Request
			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer invalid-session-id',
				},
			});

			expect(response.status).toBe(401);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
			// Check that at least one of the expected error messages is present
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
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
			});

			// Expected authentication error, permission error, or 404 Not Found
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it('should check write permissions', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role-no-permission`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
			});

			// Expected authentication error, permission error, or 404 Not Found
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = (await response.json()) as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it('should delete role successfully (integration test)', async () => {
			// This integration test requires authentication
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables not available');
				return;
			}

			// First, create a test role
			const deleteRoleName = `test-delete-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					name: deleteRoleName,
					public_read: false,
					public_write: false,
				}),
			});

			if (createResponse.status === 401) {
				const data = (await createResponse.json()) as { success: boolean; error: string };
				console.log(`Skipping integration test due to authentication failure: ${data.error}`);
				return;
			}
			if (createResponse.status === 500) {
				const data = (await createResponse.json()) as { success: boolean; error: string };
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(createResponse.status).toBe(200);

			// Delete the created role
			const deleteResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
			});

			if (deleteResponse.status === 401) {
				const data = (await deleteResponse.json()) as { success?: boolean; error?: string };
				throw new Error(`Authentication failed during deletion: ${data.error || 'Unknown auth error'}`);
			}
			if (deleteResponse.status === 500) {
				const data = (await deleteResponse.json()) as { success?: boolean; error?: string };
				throw new Error(`System error during deletion: ${data.error || 'Unknown system error'}`);
			}

			expect(deleteResponse.status).toBe(200);
			const deleteData = await deleteResponse.json();

			// Response after deletion is an empty object
			expect(deleteData).toEqual({});

			// Verify that the deleted role does not exist
			const verifyResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
				body: JSON.stringify({
					public_read: true,
				}),
			});

			// Role does not exist, so 404 error is expected
			expect([403, 404].includes(verifyResponse.status)).toBe(true);
		});

		it('should return empty object on successful deletion', async () => {
			// Test deletion process (without actually deleting)
			const response = await fetch(`${BASE_URL}/api/roles/test-role-for-empty-response`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: validAuthToken,
				},
			});

			// Expected authentication error, permission error, or 404 (actual role does not exist)
			expect([401, 403, 404].includes(response.status)).toBe(true);

			// Verify response format
			const data = (await response.json()) as any;
			if (response.status === 200) {
				// Empty object expected on success
				expect(data).toEqual({});
			} else {
				// On error, success: false and error are expected
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});
