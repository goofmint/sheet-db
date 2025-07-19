import { vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../src/db/schema';

// Mock database
export const mockDB = {
	exec: vi.fn(),
	batch: vi.fn(),
	prepare: vi.fn(() => ({
		run: vi.fn(),
		first: vi.fn(),
		all: vi.fn()
	}))
} as unknown as D1Database;

// Mock environment
export const mockEnv = {
	DB: mockDB,
	ASSETS: {
		fetch: vi.fn(() => new Response('Not Found', { status: 404 }))
	} as unknown as Fetcher
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
			// Mock sheet creation
			if (init?.method === 'POST' && urlStr.includes('sheets')) {
				return new Response(JSON.stringify({
					spreadsheetId: 'new_sheet_id',
					properties: {
						title: 'New Sheet'
					}
				}), { status: 200 });
			}
			
			// Mock batch update
			if (init?.method === 'POST' && urlStr.includes(':batchUpdate')) {
				return new Response(JSON.stringify({
					spreadsheetId: 'mock_spreadsheet_id',
					replies: []
				}), { status: 200 });
			}
			
			// Mock values update
			if (init?.method === 'PUT' && urlStr.includes('values')) {
				return new Response(JSON.stringify({
					updatedRange: 'Sheet1!A1:Z1000',
					updatedRows: 1,
					updatedColumns: 1,
					updatedCells: 1
				}), { status: 200 });
			}
			
			// Mock GET requests for sheet data
			if (init?.method === 'GET' || !init?.method) {
				// Mock _Config sheet data
				if (urlStr.includes('_Config')) {
					return new Response(JSON.stringify({
						range: '_Config!A:B',
						majorDimension: 'ROWS',
						values: [
							['CREATE_SHEET_BY_API', 'true'],
							['CREATE_SHEET_USER', ''],
							['CREATE_SHEET_ROLE', '']
						]
					}), { status: 200 });
				}
				
				// Mock _Session sheet data
				if (urlStr.includes('_Session')) {
					return new Response(JSON.stringify({
						range: '_Session!A:F',
						majorDimension: 'ROWS',
						values: [
							['id', 'user_id', 'created_at', 'updated_at', 'expires_at', 'data'],
							['test-session-fallback', 'test-user', '2024-01-01', '2024-01-01', '2024-12-31', '{}']
						]
					}), { status: 200 });
				}
				
				// Default sheet data
				return new Response(JSON.stringify({
					range: 'Sheet1!A:Z',
					majorDimension: 'ROWS',
					values: []
				}), { status: 200 });
			}
		}
		
		return new Response('Not Found', { status: 404 });
	});
};

// Setup mocks for Google auth
export const setupGoogleAuthMocks = () => {
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
};

// Setup authentication mocks
export const setupAuthMocks = () => {
	vi.mock('../../src/api/auth', () => ({
		authenticateSession: vi.fn(async (db: any, sessionId: string) => {
			// Accept both test session IDs
			if (sessionId === 'test-session-fallback' || sessionId === 'valid_session_id') {
				return {
					valid: true,
					userId: 'test-user',
					session: { id: sessionId, user_id: 'test-user' }
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
	vi.mock('../../src/utils/sheet-helpers', () => ({
		getUserFromSheet: vi.fn(async (userId: string, spreadsheetId: string, accessToken: string) => {
			if (userId === 'test-user') {
				return {
					id: 'test-user',
					email: 'test@example.com',
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
			const configs: Record<string, string> = {
				'CREATE_SHEET_BY_API': 'true',
				'CREATE_SHEET_USER': '',
				'CREATE_SHEET_ROLE': ''
			};
			const result: Record<string, string> = {};
			for (const key of keys) {
				if (key in configs) {
					result[key] = configs[key];
				}
			}
			return result;
		}),
		getConfigFromSheet: vi.fn(async (key: string) => {
			const configs: Record<string, string> = {
				'CREATE_SHEET_BY_API': 'true',
				'CREATE_SHEET_USER': '',
				'CREATE_SHEET_ROLE': ''
			};
			return configs[key] || null;
		})
	}));
};

// Setup Cache table mocks
export const setupCacheMocks = () => {
	const mockCacheData: any[] = [];
	
	vi.mock('../../src/db/schema', () => ({
		Cache: {
			// Mock schema object
		}
	}));
};

// Setup all mocks at once
export const setupAllSheetMocks = () => {
	setupFetchMocks();
	setupGoogleAuthMocks();
	setupAuthMocks();
	setupSheetHelpersMocks();
	setupCacheMocks();
};