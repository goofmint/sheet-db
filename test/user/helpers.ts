import { vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

export type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
};

// Mock database for testing
export const mockDatabase = {
	select: () => ({
		from: () => ({
			where: () => ({
				get: () => Promise.resolve(null),
				all: () => Promise.resolve([])
			})
		})
	}),
	insert: () => ({
		into: () => ({
			values: () => ({
				returning: () => Promise.resolve([])
			})
		})
	}),
	update: () => ({
		set: () => ({
			where: () => ({
				returning: () => Promise.resolve([])
			})
		})
	})
} as any;

// Mock Google Sheets API responses
export const mockUserSheetData = {
	values: [
		['id', 'email', 'name', 'given_name', 'family_name', 'nickname', 'picture', 'email_verified', 'locale', 'roles', 'created_at', 'updated_at', 'last_login'],
		['string', 'email', 'string', 'string', 'string', 'string', 'string', 'boolean', 'string', 'array', 'datetime', 'datetime', 'datetime'],
		['user123', 'user@example.com', 'Test User', 'Test', 'User', 'testuser', 'https://example.com/avatar.jpg', 'TRUE', 'en', '["admin"]', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z']
	]
};

// Mock empty sheet data for non-existent users
export const mockEmptySheetData = {
	values: [
		['id'],
		['string']
	]
};

// Mock environment
export const mockEnv = {
	DB: mockDatabase,
};

// Setup fetch mocks
export const setupFetchMocks = () => {
	globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const urlStr = input.toString();
		
		// Mock successful authentication token
		if (urlStr.includes('oauth2/v4/token')) {
			return new Response(JSON.stringify({
				access_token: 'mock_access_token',
				expires_in: 3600,
				token_type: 'Bearer'
			}), { status: 200 });
		}
		
		// Mock Google Sheets API calls
		if (urlStr.includes('sheets.googleapis.com')) {
			if (init?.method === 'PUT') {
				return new Response(JSON.stringify({ updatedData: true }), { status: 200 });
			}
			
			// Return mock user data
			return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
		}
		
		return new Response('Not Found', { status: 404 });
	});
};

// Setup mocks for Google auth
export const setupGoogleAuthMocks = () => {
	vi.mock('../src/google-auth', () => ({
		getConfig: vi.fn(async (db: any, key: string) => {
			if (key === 'spreadsheet_id') return 'mock_spreadsheet_id';
			if (key === 'google_client_id') return 'mock_client_id';
			if (key === 'google_client_secret') return 'mock_client_secret';
			return null;
		}),
		getGoogleTokens: vi.fn(async () => ({
			access_token: 'mock_access_token',
			refresh_token: 'mock_refresh_token',
			expires_at: Date.now() + 3600000
		})),
		isTokenValid: vi.fn(async () => true),
		refreshAccessToken: vi.fn(async () => ({
			access_token: 'mock_access_token',
			refresh_token: 'mock_refresh_token',
			expires_at: Date.now() + 3600000
		})),
		saveGoogleTokens: vi.fn(async () => {}),
		getGoogleCredentials: vi.fn(async () => ({
			client_id: 'mock_client_id',
			client_secret: 'mock_client_secret'
		}))
	}));
};

// Setup authentication mocks
export const setupAuthMocks = () => {
	vi.mock('../src/api/auth', () => ({
		authenticateSession: vi.fn(async (db: any, sessionId: string) => {
			if (sessionId === 'valid_session_id') {
				return {
					valid: true,
					userId: 'user123',
					session: { id: sessionId, user_id: 'user123' }
				};
			}
			return {
				valid: false,
				error: 'Invalid session'
			};
		})
	}));
};

// Setup sheet helpers mocks
export const setupSheetHelpersMocks = () => {
	vi.mock('../src/utils/sheet-helpers', () => ({
		getUserFromSheet: vi.fn(async (userId: string, spreadsheetId: string, accessToken: string) => {
			if (userId === 'user123') {
				return {
					id: 'user123',
					email: 'user@example.com',
					name: 'Test User',
					given_name: 'Test',
					family_name: 'User',
					nickname: 'testuser',
					picture: 'https://example.com/avatar.jpg',
					email_verified: true,
					locale: 'en',
					roles: ['admin'],
					created_at: '2023-01-01T00:00:00Z',
					updated_at: '2023-01-01T00:00:00Z',
					last_login: '2023-01-01T00:00:00Z'
				};
			}
			return null;
		}),
		getMultipleConfigsFromSheet: vi.fn(async () => ({})),
		getConfigFromSheet: vi.fn(async () => null)
	}));
};

// Setup all mocks at once
export const setupAllMocks = () => {
	setupFetchMocks();
	setupGoogleAuthMocks();
	setupAuthMocks();
	setupSheetHelpersMocks();
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

// Mock fetch for non-existent user
export const mockFetchForNonExistentUser = () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = input.toString();
		if (url.includes('sheets.googleapis.com')) {
			return new Response(JSON.stringify(mockEmptySheetData), { status: 200 });
		}
		return originalFetch(input, init);
	});
	return originalFetch;
};