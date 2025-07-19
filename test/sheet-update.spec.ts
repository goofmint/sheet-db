import { describe, it, expect, beforeAll, vi } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';

type Bindings = {
	DB: D1Database;
	ASSETS: Fetcher;
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
		['UPDATE_SHEET_BY_API', 'true'],
		['UPDATE_SHEET_USER', '["user123"]'],
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

const mockSpreadsheetMetadata = {
	sheets: [{
		properties: {
			sheetId: 12345,
			title: 'TestSheet'
		}
	}]
};

const mockSheetData = {
	values: [
		['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
		['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
		['1', 'TestData', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'true', 'false', '[]', '[]', '[]', '["user123"]']
	]
};

const mockBatchUpdateResponse = {
	replies: [{ updateSheetProperties: {} }, { updateCells: {} }]
};

// Mock Google Sheets API
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

// Mock shared sheet helpers
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

describe('Sheet Update API', () => {
	let app: OpenAPIHono<{ Bindings: Bindings }>;

	beforeAll(async () => {
		const { registerSheetRoutes } = await import('../src/api/sheet');
		app = new OpenAPIHono<{ Bindings: Bindings }>();
		registerSheetRoutes(app);
	}, 30000);

	describe('PUT /api/sheets/:id', () => {
		it('should update sheet name successfully', async () => {
			const updateData = {
				name: 'UpdatedSheetName'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'UpdatedSheetName');
			expect(data.data).toHaveProperty('sheetId', 12345);
			expect(data.data.message).toContain('updated successfully');
		});

		it('should update permissions successfully', async () => {
			const updateData = {
				public_read: false,
				public_write: true,
				role_read: ['viewer'],
				role_write: ['editor'],
				user_read: ['user456'],
				user_write: ['user789']
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('public_read', false);
			expect(data.data).toHaveProperty('public_write', true);
			expect(data.data).toHaveProperty('role_read', ['viewer']);
			expect(data.data).toHaveProperty('role_write', ['editor']);
			expect(data.data).toHaveProperty('user_read', ['user456']);
			expect(data.data).toHaveProperty('user_write', ['user789']);
		});

		it('should update name and permissions together', async () => {
			const updateData = {
				name: 'NewSheetName',
				public_read: true,
				public_write: false,
				role_write: ['admin']
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'NewSheetName');
			expect(data.data).toHaveProperty('public_read', true);
			expect(data.data).toHaveProperty('public_write', false);
			expect(data.data).toHaveProperty('role_write', ['admin']);
		});

		it('should allow update when user has write permission', async () => {
			// Mock sheet metadata to include user in user_write
			const mockSheetDataWithPermissions = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'false', '[]', '[]', '[]', '["user123"]']
				]
			};

			// Override the mock for this specific test
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
							values: [mockSheetDataWithPermissions.values[0]]  // Just the headers
						}), { status: 200 });
					}
					
					// Mock sheet data (for metadata in row 3)
					if (urlStr.includes('TestSheet!A3:ZZ3')) {
						return new Response(JSON.stringify({
							values: [mockSheetDataWithPermissions.values[2]]  // Just the data row
						}), { status: 200 });
					}
				}
				
				return new Response('Not Found', { status: 404 });
			});

			const updateData = {
				name: 'UpdatedByUser'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'UpdatedByUser');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should deny update when user has no write permission', async () => {
			// Mock sheet metadata without user write permission
			const mockSheetDataNoPermissions = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'true', 'false', '[]', '[]', '[]', '["other_user"]']
				]
			};

			// Override the mock for this specific test
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
							values: [mockSheetDataNoPermissions.values[0]]  // Just the headers
						}), { status: 200 });
					}
					
					// Mock sheet data (for metadata in row 3)
					if (urlStr.includes('TestSheet!A3:ZZ3')) {
						return new Response(JSON.stringify({
							values: [mockSheetDataNoPermissions.values[2]]  // Just the data row
						}), { status: 200 });
					}
				}
				
				return new Response('Not Found', { status: 404 });
			});

			const updateData = {
				name: 'ShouldNotUpdate'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(403);
			expect(data.success).toBe(false);
			expect(data.error).toContain('No write permission');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should return 401 for unauthenticated request', async () => {
			const updateData = {
				name: 'UpdatedName'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer invalid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(401);
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should allow update when public_write is true', async () => {
			// Mock sheet metadata with public_write = true
			const mockSheetDataPublicWrite = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'true', '[]', '[]', '[]', '[]']
				]
			};

			// Override the mock for this specific test
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
							values: [mockSheetDataPublicWrite.values[0]]  // Just the headers
						}), { status: 200 });
					}
					
					// Mock sheet data (for metadata in row 3)
					if (urlStr.includes('TestSheet!A3:ZZ3')) {
						return new Response(JSON.stringify({
							values: [mockSheetDataPublicWrite.values[2]]  // Just the data row
						}), { status: 200 });
					}
				}
				
				return new Response('Not Found', { status: 404 });
			});

			const updateData = {
				name: 'PublicUpdateSheet'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'PublicUpdateSheet');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should allow update when user has required role', async () => {
			// Mock sheet metadata with role_write containing user's role
			const mockSheetDataRoleWrite = {
				values: [
					['id', 'name', 'created_at', 'updated_at', 'public_read', 'public_write', 'role_read', 'role_write', 'user_read', 'user_write'],
					['string', 'string', 'datetime', 'datetime', 'boolean', 'boolean', 'array', 'array', 'array', 'array'],
					['1', 'TestItem', '2023-01-01T00:00:00Z', '2023-01-01T00:00:00Z', 'false', 'false', '[]', '["admin"]', '[]', '[]']
				]
			};

			// Override the mock for this specific test
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
							values: [mockSheetDataRoleWrite.values[0]]  // Just the headers
						}), { status: 200 });
					}
					
					// Mock sheet data (for metadata in row 3)
					if (urlStr.includes('TestSheet!A3:ZZ3')) {
						return new Response(JSON.stringify({
							values: [mockSheetDataRoleWrite.values[2]]  // Just the data row
						}), { status: 200 });
					}
				}
				
				return new Response('Not Found', { status: 404 });
			});

			const updateData = {
				name: 'RoleUpdateSheet'
			};

			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('name', 'RoleUpdateSheet');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should return 400 for empty update data', async () => {
			const req = new Request('http://localhost/api/sheets/12345', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({})
			});

			const res = await app.fetch(req, mockEnv);

			expect(res.status).toBe(400); // Should fail validation for empty update data
		});

		it('should return 404 for non-existent sheet', async () => {
			// Mock fetch to return empty metadata for non-existent sheet
			const originalFetch = globalThis.fetch;
			globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const urlStr = input.toString();
				
				if (urlStr.includes('/spreadsheets/') && !urlStr.includes('/values/')) {
					return new Response(JSON.stringify({ sheets: [] }), { status: 200 });
				}
				
				return originalFetch(input, init);
			});

			const updateData = {
				name: 'UpdatedName'
			};

			const req = new Request('http://localhost/api/sheets/99999', {
				method: 'PUT',
				headers: {
					'Authorization': 'Bearer valid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updateData)
			});

			const res = await app.fetch(req, mockEnv);
			const data = await res.json() as any;

			expect(res.status).toBe(404);
			expect(data.success).toBe(false);
			expect(data.error).toContain('not found');

			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

	});
});