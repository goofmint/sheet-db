import { beforeAll, afterAll } from 'vitest';
import { authenticateWithAuth0, getAuth0TestCredentials, BASE_URL } from '../helpers/auth.js';
import type { ApiErrorResponse, RoleCreateResponse, RoleDeleteResponse, RolesResponse } from '../types/api-responses';

// Shared test state
export let testSessionId: string;
export let validAuthToken: string;

// Auth0 test environment variables
export const { email: auth0TestEmail, password: auth0TestPassword } = getAuth0TestCredentials();

// Helper functions for common test patterns
export function createAuthHeaders(sessionId: string | null): HeadersInit {
	return sessionId ? { 'Authorization': `Bearer ${sessionId}` } : {};
}

export function createJsonHeaders(sessionId: string | null): HeadersInit {
	return {
		'Content-Type': 'application/json',
		...createAuthHeaders(sessionId)
	};
}

export function requireSession(sessionId: string | null): asserts sessionId is string {
	if (!sessionId) throw new Error('Test session not available');
}

// Setup function for role tests
export function setupRoleTests() {
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
}

// Export types for convenience
export type { ApiErrorResponse, RoleCreateResponse, RoleDeleteResponse, RolesResponse };
export { BASE_URL };