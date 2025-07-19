import { OpenAPIHono } from '@hono/zod-openapi';
import type { D1Database, Fetcher } from '@cloudflare/workers-types';
import { BASE_URL } from '../helpers/auth';
import { getGlobalAuth } from '../setup/global-auth';

export type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};

// Setup authentication for user tests
export const setupUserAuth = async (): Promise<{
	sessionId: string;
	userInfo: { sub: string; email: string };
}> => {
	// Use global authentication (shared across all test files)
	const auth = await getGlobalAuth();
	
	return {
		sessionId: auth.sessionId,
		userInfo: auth.userInfo
	};
};

// Create app instance with user routes
export const createUserApp = async (): Promise<OpenAPIHono<{ Bindings: Bindings }>> => {
	const { registerUserRoutes } = await import('../../src/api/user');
	const app = new OpenAPIHono<{ Bindings: Bindings }>();
	registerUserRoutes(app);
	return app;
};

// Common request headers
export const createAuthHeaders = (sessionId: string, contentType = false) => {
	const headers: Record<string, string> = {
		'Authorization': `Bearer ${sessionId}`
	};
	
	if (contentType) {
		headers['Content-Type'] = 'application/json';
	}
	
	return headers;
};

// Export BASE_URL for convenience
export { BASE_URL };