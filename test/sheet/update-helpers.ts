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
export const mockConfigSheetData = {
	values: [
		['key', 'value'],
		['UPDATE_SHEET_BY_API', 'true'],
		['UPDATE_SHEET_USER', '["user123"]'],
		['CREATE_SHEET_ROLE', '["admin"]']
	]
};

export const mockUserSheetData = {
	values: [
		['id', 'email', 'name', 'given_name', 'family_name', 'nickname', 'picture', 'email_verified', 'locale', 'roles', 'created_at', 'updated_at', 'last_login'],
		['string', 'email', 'string', 'string', 'string', 'string', 'string', 'boolean', 'string', 'array', 'datetime', 'datetime', 'datetime'],
		['user123', 'user@example.com', 'Test User', 'Test', 'User', 'testuser', 'https://example.com/avatar.jpg', 'TRUE', 'en', '["admin"]', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z']
	]
};

export const mockSpreadsheetMetadata = {
	sheets: [{
		properties: {
			sheetId: 12345,
			title: 'TestSheet'
		}
	}]
};

export const mockSheetData = {
	values: [
		['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
		['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
		['1', 'TestData', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'true', 'false', '[]', '[]', '[]', '["user123"]']
	]
};

export const mockBatchUpdateResponse = {
	replies: [{ updateSheetProperties: {} }, { updateCells: {} }]
};

// Mock environment
export const mockEnv = {
	DB: mockDatabase,
};

// Setup base fetch mock
export const setupBaseFetchMock = () => {
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
			// Mock batchUpdate
			if (urlStr.includes('batchUpdate') && init?.method === 'POST') {
				return new Response(JSON.stringify(mockBatchUpdateResponse), { status: 200 });
			}
			
			// Mock spreadsheet metadata
			if (urlStr.includes('/spreadsheets/') && !urlStr.includes('/values/') && !urlStr.includes('batchUpdate')) {
				return new Response(JSON.stringify(mockSpreadsheetMetadata), { status: 200 });
			}
			
			// Mock config sheet data
			if (urlStr.includes('_Config!A:B')) {
				return new Response(JSON.stringify(mockConfigSheetData), { status: 200 });
			}
			
			// Mock user sheet data
			if (urlStr.includes('_User!A:N')) {
				return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
			}
			
			// Mock sheet data (for specific sheet headers and types)
			if (urlStr.includes('TestSheet!A1:ZZ2')) {
				return new Response(JSON.stringify(mockSheetData), { status: 200 });
			}
			
			// Mock sheet data (for headers only)
			if (urlStr.includes('TestSheet!A1:ZZ1')) {
				return new Response(JSON.stringify({
					values: [mockSheetData.values[0]]  // Just the headers
				}), { status: 200 });
			}
			
			// Mock sheet data (for metadata in row 3)
			if (urlStr.includes('TestSheet!A3:ZZ3')) {
				return new Response(JSON.stringify({
					values: [mockSheetData.values[2]]  // Just the data row
				}), { status: 200 });
			}
		}
		
		return new Response('Not Found', { status: 404 });
	});
};

// Setup custom fetch mock for specific permissions tests
export const setupCustomFetchMock = (customSheetData: any) => {
	const originalFetch = globalThis.fetch;
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
			// Mock batchUpdate
			if (urlStr.includes('batchUpdate') && init?.method === 'POST') {
				return new Response(JSON.stringify(mockBatchUpdateResponse), { status: 200 });
			}
			
			// Mock spreadsheet metadata
			if (urlStr.includes('/spreadsheets/') && !urlStr.includes('/values/') && !urlStr.includes('batchUpdate')) {
				return new Response(JSON.stringify(mockSpreadsheetMetadata), { status: 200 });
			}
			
			// Mock config sheet data
			if (urlStr.includes('_Config!A:B')) {
				return new Response(JSON.stringify(mockConfigSheetData), { status: 200 });
			}
			
			// Mock user sheet data
			if (urlStr.includes('_User!A:N')) {
				return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
			}
			
			// Mock sheet data (for specific sheet headers and types)
			if (urlStr.includes('TestSheet!A1:ZZ2')) {
				return new Response(JSON.stringify(mockSheetData), { status: 200 });
			}
			
			// Mock sheet data (for headers only)
			if (urlStr.includes('TestSheet!A1:ZZ1')) {
				return new Response(JSON.stringify({
					values: [customSheetData.values[0]]  // Just the headers
				}), { status: 200 });
			}
			
			// Mock sheet data (for metadata in row 3)
			if (urlStr.includes('TestSheet!A3:ZZ3')) {
				return new Response(JSON.stringify({
					values: [customSheetData.values[2]]  // Just the data row
				}), { status: 200 });
			}
		}
		
		return new Response('Not Found', { status: 404 });
	});
	return originalFetch;
};

// Setup all mocks
export const setupAllMocks = () => {
	setupBaseFetchMock();
	
	// Mock Google auth
	vi.mock('../../src/google-auth', () => ({
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

	// Mock authentication
	vi.mock('../../src/api/auth', () => ({
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

	// Mock sheet helpers
	vi.mock('../../src/utils/sheet-helpers', () => ({
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
		getMultipleConfigsFromSheet: vi.fn(async (keys: string[], spreadsheetId: string, accessToken: string) => {
			return {
				'UPDATE_SHEET_BY_API': 'true',
				'UPDATE_SHEET_USER': '["user123"]',
				'CREATE_SHEET_ROLE': '["admin"]'
			};
		}),
		getConfigFromSheet: vi.fn(async (key: string) => {
			if (key === 'UPDATE_SHEET_BY_API') return 'true';
			if (key === 'UPDATE_SHEET_USER') return '["user123"]';
			if (key === 'CREATE_SHEET_ROLE') return '["admin"]';
			return null;
		})
	}));
};

// Create app instance
export const createUpdateApp = async (): Promise<OpenAPIHono<{ Bindings: Bindings }>> => {
	const { registerSheetRoutes } = await import('../../src/api/sheet');
	const app = new OpenAPIHono<{ Bindings: Bindings }>();
	registerSheetRoutes(app);
	return app;
};

// Create request headers
export const createAuthHeaders = (sessionId: string, contentType = true) => {
	const headers: Record<string, string> = {
		'Authorization': `Bearer ${sessionId}`
	};
	
	if (contentType) {
		headers['Content-Type'] = 'application/json';
	}
	
	return headers;
};