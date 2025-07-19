import { beforeAll, afterAll } from 'vitest';
import { getSharedAuth } from '../setup/shared-auth.js';
import { BASE_URL } from '../helpers/auth.js';
import type { ApiErrorResponse, RoleCreateResponse, RoleDeleteResponse, RolesResponse } from '../types/api-responses';

// Shared test state
export let testSessionId: string;
export let validAuthToken: string;

// Shared authentication state

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
		console.log('Setting up shared authentication for role tests...');
		
		const auth = await getSharedAuth();
		testSessionId = auth.sessionId;
		validAuthToken = `Bearer ${testSessionId}`;
		
		console.log('✅ Role tests using shared authentication');
	});

	afterAll(async () => {
		// Post-test cleanup
		// Implement here if deletion of created test roles etc. is needed
	});
}

// Export types for convenience
export type { ApiErrorResponse, RoleCreateResponse, RoleDeleteResponse, RolesResponse };
export { BASE_URL };