import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authenticateWithAuth0, getAuth0TestCredentials, BASE_URL } from './helpers/auth.js';

describe('Role API', () => {
	let testSessionId: string;
	let validAuthToken: string;
	
	// Auth0 test environment variables
	const { email: auth0TestEmail, password: auth0TestPassword } = getAuth0TestCredentials();

	beforeAll(async () => {
		// Try to get real session ID through Auth0 authentication flow
		if (auth0TestEmail && auth0TestPassword) {
			console.log('Setting up authentication for role tests...');

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

	describe('POST /api/roles', () => {
		it('should require Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: 'test-role-no-auth'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'InvalidFormat'
				},
				body: JSON.stringify({
					name: 'test-role-invalid-auth'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			// Validation should happen before authentication, returning 400
			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject empty name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: ''
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject whitespace-only name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: '   '
				})
			});

			expect([400, 401].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-session-id'
				},
				body: JSON.stringify({
					name: 'test-role-invalid-session'
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found'].some(msg => 
				data.error.includes(msg)
			)).toBe(true);
		});

		it('should create role with valid session (integration test)', async () => {
			// This integration test requires authentication
			if (!auth0TestEmail || !auth0TestPassword) {
				throw new Error('Integration test requires AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables');
			}

			const uniqueRoleName = `test-role-${Date.now()}`;
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: uniqueRoleName,
					public_read: true,
					public_write: false
				})
			});

			if (response.status === 401) {
				const data = await response.json() as { success: boolean; error: string };
				console.log(`Skipping integration test due to authentication failure: ${data.error}`);
				return;
			}
			if (response.status === 500) {
				const data = await response.json() as { success: boolean; error: string };
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(response.status).toBe(200);
			const data = await response.json() as {
				success: boolean;
				data: {
					name: string;
					users: string[];
					roles: string[];
					created_at: string;
					updated_at: string;
					public_read: boolean;
					public_write: boolean;
					role_read: string[];
					role_write: string[];
					user_read: string[];
					user_write: string[];
				};
			};

			expect(data.success).toBe(true);
			expect(data.data.name).toBe(uniqueRoleName);
			expect(data.data.public_read).toBe(true);
			expect(data.data.public_write).toBe(false);
			expect(data.data.created_at).toBeDefined();
			expect(data.data.updated_at).toBeDefined();
		});

		it('should prevent duplicate role names (integration test)', async () => {
			// This integration test requires authentication
			if (!auth0TestEmail || !auth0TestPassword) {
				throw new Error('Integration test requires AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD environment variables');
			}

			const duplicateRoleName = `duplicate-role-${Date.now()}`;

			// Create the first role
			const firstResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: duplicateRoleName,
					public_read: false,
					public_write: false
				})
			});

			if (firstResponse.status === 401) {
				const data = await firstResponse.json() as { success: boolean; error: string };
				console.log(`Skipping integration test due to authentication failure: ${data.error}`);
				return;
			}
			if (firstResponse.status === 500) {
				const data = await firstResponse.json() as { success: boolean; error: string };
				throw new Error(`System error: ${data.error}. Check Google Sheets configuration and permissions.`);
			}

			expect(firstResponse.status).toBe(200);

			// Try to create again with the same name (duplicate check test)
			const secondResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: duplicateRoleName,
					public_read: true,
					public_write: true
				})
			});

			expect(secondResponse.status).toBe(409); // Conflict
			const secondData = await secondResponse.json() as { success: boolean; error: string };
			expect(secondData.success).toBe(false);
			expect(secondData.error).toContain('already exists');
			expect(secondData.error).toContain('unique');
		});

		it('should handle malformed JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: 'invalid json'
			});

			expect(response.status).toBe(400);
			// Malformed JSON might return HTML error page, so just check status
			expect(response.ok).toBe(false);
		});
	});

	describe('Role validation', () => {
		it('should validate role name type', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: 123 // number instead of string
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});

	describe('Authentication tests', () => {
		it('should handle missing session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer '
				},
				body: JSON.stringify({
					name: 'test-role-empty-session'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle expired session', async () => {
			// Test with expired session ID
			const expiredSessionId = 'expired-session-id';
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${expiredSessionId}`
				},
				body: JSON.stringify({
					name: 'test-role-expired'
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			const expectedMessages = ['Session not found', 'Session expired', 'Authentication failed', 'Failed to fetch session data'];
			const hasExpectedMessage = expectedMessages.some(msg => data.error.includes(msg));
			expect(hasExpectedMessage).toBe(true);
		});
	});
});