import { describe, it, expect, beforeAll, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

type Bindings = {
	DB: D1Database;
};

// Mock functions for testing
const mockDatabase = {
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
const mockConfigSheetData = {
	values: [
		['key', 'value'],
		['CREATE_SHEET_BY_API', 'true'],
		['CREATE_SHEET_USER', '["user123"]'],
		['CREATE_SHEET_ROLE', '["admin"]']
	]
};

const mockUserSheetData = {
	values: [
		['id', 'email', 'name', 'given_name', 'family_name', 'nickname', 'picture', 'email_verified', 'locale', 'roles', 'created_at', 'updated_at', 'last_login'],
		['string', 'email', 'string', 'string', 'string', 'string', 'string', 'boolean', 'string', 'array', 'datetime', 'datetime', 'datetime'],
		['user123', 'user@example.com', 'Test User', 'Test', 'User', 'testuser', 'https://example.com/avatar.jpg', 'TRUE', 'en', '["admin"]', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z']
	]
};

const mockSheetCreationResponse = {
	replies: [{
		addSheet: {
			properties: {
				sheetId: 12345,
				title: 'TestSheet'
			}
		}
	}]
};

// Mock Google Sheets API
global.fetch = vi.fn(async (url: string, options?: any) => {
	const urlStr = url.toString();
	
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
		if (urlStr.includes('batchUpdate') && options?.method === 'POST') {
			return new Response(JSON.stringify(mockSheetCreationResponse), { status: 200 });
		}
		
		// Mock header/type row updates
		if (options?.method === 'PUT') {
			return new Response(JSON.stringify({ updatedData: true }), { status: 200 });
		}
		
		// Mock config sheet data
		if (urlStr.includes('_Config!A:B')) {
			return new Response(JSON.stringify(mockConfigSheetData), { status: 200 });
		}
		
		// Mock user sheet data
		if (urlStr.includes('_User!A:N')) {
			return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
		}
	}
	
	return new Response('Not Found', { status: 404 });
});

// Mock environment
const mockEnv = {
	DB: mockDatabase,
};

// Mock configuration
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

// Mock authenticateSession
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

describe('Sheet API', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		const { registerSheetRoutes } = await import('../src/api/sheet');
		app = new OpenAPIHono<{ Bindings: Bindings }>();
		registerSheetRoutes(app);
	});

	describe('POST /api/sheets', () => {
		it('should create a new sheet with valid data and permissions', async () => {
			const createData = {
				sheetName: 'TestSheet',
				columns: {
					title: 'string',
					description: 'string',
					count: 'number',
					active: 'boolean'
				}
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});
			const data = await res.json();

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('sheetName', 'TestSheet');
			expect(data.data).toHaveProperty('sheetId', 12345);
			expect(data.data).toHaveProperty('columns', createData.columns);
			expect(data.data).toHaveProperty('totalColumns', 13); // 9 default + 4 user columns
			expect(data.data.message).toContain('created successfully');
		});

		it('should return 401 for unauthenticated request', async () => {
			const createData = {
				sheetName: 'TestSheet',
				columns: { title: 'string' }
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer invalid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});
			const data = await res.json();

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return 400 for reserved column names', async () => {
			const createData = {
				sheetName: 'TestSheet',
				columns: {
					id: 'string', // Reserved column name
					title: 'string'
				}
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});

			expect(res.status).toBe(400); // Should fail validation due to reserved column name
		});

		it('should return 403 when sheet creation is disabled', async () => {
			// Mock config to return false for CREATE_SHEET_BY_API
			const originalFetch = global.fetch;
			global.fetch = vi.fn(async (url: string, options?: any) => {
				const urlStr = url.toString();
				
				if (urlStr.includes('_Config!A:B')) {
					return new Response(JSON.stringify({
						values: [
							['key', 'value'],
							['CREATE_SHEET_BY_API', 'false']
						]
					}), { status: 200 });
				}
				
				if (urlStr.includes('_User!A:N')) {
					return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
				}
				
				return originalFetch(url, options);
			});

			const createData = {
				sheetName: 'TestSheet',
				columns: { title: 'string' }
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});
			const data = await res.json();

			expect(res.status).toBe(403);
			expect(data.success).toBe(false);
			expect(data.error).toContain('disabled');

			// Restore original fetch
			global.fetch = originalFetch;
		});

		it('should return 403 when user lacks required role', async () => {
			// Mock config to require different role
			const originalFetch = global.fetch;
			global.fetch = vi.fn(async (url: string, options?: any) => {
				const urlStr = url.toString();
				
				if (urlStr.includes('_Config!A:B')) {
					return new Response(JSON.stringify({
						values: [
							['key', 'value'],
							['CREATE_SHEET_BY_API', 'true'],
							['CREATE_SHEET_ROLE', '["super_admin"]'] // Different role required
						]
					}), { status: 200 });
				}
				
				if (urlStr.includes('_User!A:N')) {
					return new Response(JSON.stringify(mockUserSheetData), { status: 200 });
				}
				
				return originalFetch(url, options);
			});

			const createData = {
				sheetName: 'TestSheet',
				columns: { title: 'string' }
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});
			const data = await res.json();

			expect(res.status).toBe(403);
			expect(data.success).toBe(false);
			expect(data.error).toContain('role not authorized');

			// Restore original fetch
			global.fetch = originalFetch;
		});

		it('should handle various column types correctly', async () => {
			const createData = {
				sheetName: 'ComplexSheet',
				columns: {
					title: 'string',
					price: 'number',
					published_at: 'datetime',
					is_active: 'boolean',
					tags: 'array',
					metadata: 'object',
					author_ref: 'pointer'
				}
			};

			const req = new Request('http://localhost/api/sheets', {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			const res = await app.request(req, mockEnv, {});
			const data = await res.json();

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data.columns).toEqual(createData.columns);
			expect(data.data.totalColumns).toBe(16); // 9 default + 7 user columns
		});
	});
});