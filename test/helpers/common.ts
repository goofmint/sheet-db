/**
 * Common helper functions shared across test files
 */

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