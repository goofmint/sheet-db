import { beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';
import type { ApiResponse, AuthCallbackResponse, AuthLogoutResponse, ApiErrorResponse, RoleCreateResponse } from '../types/api-responses';

// Shared test state
export let testAuth0Code: string;
export let testSessionId: string;

// Auth0 test environment variables from cloudflare:test
export const auth0Domain = env.AUTH0_DOMAIN;
export const auth0ClientId = env.AUTH0_CLIENT_ID;
export const auth0ClientSecret = env.AUTH0_CLIENT_SECRET;
export const auth0TestEmail = env.AUTH0_TEST_EMAIL;
export const auth0TestPassword = env.AUTH0_TEST_PASSWORD;

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

// Setup function for auth tests
export function setupAuthTests() {
	beforeAll(async () => {
		// Check environment variables from cloudflare:test
		if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
			console.log('Warning: Required Auth0 environment variables not found. Some tests may be skipped.');
			console.log('Please ensure .dev.vars contains: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET');
		}

		// テスト用のモックデータ
		testAuth0Code = 'test-auth-code-123';
		testSessionId = 'test-session-uuid-456';
	});
}

// Export types for convenience
export type { ApiResponse, AuthCallbackResponse, AuthLogoutResponse, ApiErrorResponse, RoleCreateResponse };
export { BASE_URL };