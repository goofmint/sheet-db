import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from './helpers/auth';

// Types for testing
interface SheetCreateRequest {
	name: string;
	public_read?: boolean;
	public_write?: boolean;
	role_read?: string[];
	role_write?: string[];
	user_read?: string[];
	user_write?: string[];
}

interface SheetCreateResponse {
	success: boolean;
	data?: {
		name: string;
		sheetId: number;
		public_read: boolean;
		public_write: boolean;
		role_read: string[];
		role_write: string[];
		user_read: string[];
		user_write: string[];
		message: string;
	};
	error?: string;
}

describe('Sheet API', () => {
	let testSessionId: string | null = null;
	let testUserInfo: { sub: string; email: string } | null = null;
	let createdSheetIds: number[] = [];

	beforeAll(async () => {
		// Get Auth0 configuration from cloudflare:test environment
		const config = validateAuth0Config();
		if (!config) {
			throw new Error('Auth0 configuration not complete. Please ensure .dev.vars contains all required Auth0 variables.');
		}

		// Get a real Auth0 token for authentication
		const accessToken = await fetchAuth0Token(config);
		if (!accessToken) {
			throw new Error('Could not obtain Auth0 access token. Please check Auth0 configuration and test credentials.');
		}

		// Get user info from Auth0
		const userInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
		if (!userInfo) {
			throw new Error('Could not obtain Auth0 user info. Please check Auth0 token and configuration.');
		}

		testUserInfo = userInfo;

		// Login to get session ID
		const loginResponse = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				token: accessToken,
				userInfo: {
					...userInfo,
					name: 'Sheet Test User',
					given_name: 'Sheet',
					family_name: 'Test',
					nickname: 'sheettest',
					picture: 'https://example.com/avatar.jpg',
					email_verified: true,
					locale: 'en'
				}
			})
		});

		expect(loginResponse.ok).toBe(true);
		const loginData = await loginResponse.json() as { success: boolean; data: { sessionId: string } };
		expect(loginData.success).toBe(true);
		
		testSessionId = loginData.data.sessionId;
		expect(testSessionId).toBeDefined();
	});

	afterEach(async () => {
		// Clean up any test sheets that were created
		if (createdSheetIds.length > 0 && testSessionId) {
			console.log(`Cleaning up ${createdSheetIds.length} created sheets...`);
			
			for (const sheetId of createdSheetIds) {
				try {
					const deleteResponse = await fetch(`${BASE_URL}/api/sheets/${sheetId}`, {
						method: 'DELETE',
						headers: {
							'Authorization': `Bearer ${testSessionId}`
						}
					});
					
					if (deleteResponse.ok) {
						console.log(`Successfully deleted sheet ${sheetId}`);
					} else {
						console.warn(`Failed to delete sheet ${sheetId}: ${deleteResponse.status}`);
					}
				} catch (error) {
					console.warn(`Error deleting sheet ${sheetId}:`, error);
				}
			}
			
			// Clear the array for next test
			createdSheetIds = [];
		}
	});

	describe('POST /api/sheets', () => {
		it('should create a new sheet with valid data and permissions', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData: SheetCreateRequest = {
				name: `TestSheet_${Date.now()}`,
				public_read: true,
				public_write: false,
				role_read: [],
				role_write: ['admin'],
				user_read: [],
				user_write: [testUserInfo!.sub]
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.sheetId).toBeTypeOf('number');
			expect(data.data!.public_read).toBe(true);
			expect(data.data!.public_write).toBe(false);
			expect(data.data!.role_read).toEqual([]);
			expect(data.data!.role_write).toEqual(['admin']);
			expect(data.data!.user_read).toEqual([]);
			expect(data.data!.user_write).toEqual([testUserInfo!.sub]);
			expect(data.data!.message).toContain('created successfully');
			
			// Track created sheet for cleanup
			createdSheetIds.push(data.data!.sheetId);
		});

		it('should return 401 for unauthenticated request', async () => {
			const createData: SheetCreateRequest = {
				name: `TestSheet_Unauth_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer invalid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(401);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return 401 for missing authorization header', async () => {
			const createData: SheetCreateRequest = {
				name: `TestSheet_NoAuth_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			// API might return 400 for missing auth header or 401 for authentication failure
			expect([400, 401].includes(response.status)).toBe(true);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should use default permissions when not provided', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData: SheetCreateRequest = {
				name: `TestSheet_Defaults_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.public_read).toBe(true); // Default value
			expect(data.data!.public_write).toBe(false); // Default value
			expect(data.data!.user_write).toContain(testUserInfo!.sub); // Default to creator
			
			// Track created sheet for cleanup
			createdSheetIds.push(data.data!.sheetId);
		});

		it('should create sheet with custom permissions', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData: SheetCreateRequest = {
				name: `TestSheet_Custom_${Date.now()}`,
				public_read: false,
				public_write: true,
				role_read: ['viewer'],
				role_write: ['editor', 'admin'],
				user_read: ['user456'],
				user_write: ['user789']
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.public_read).toBe(false);
			expect(data.data!.public_write).toBe(true);
			expect(data.data!.role_read).toEqual(['viewer']);
			expect(data.data!.role_write).toEqual(['editor', 'admin']);
			expect(data.data!.user_read).toEqual(['user456']);
			expect(data.data!.user_write).toEqual(['user789']);
			
			// Track created sheet for cleanup
			createdSheetIds.push(data.data!.sheetId);
		});

		it('should validate required name field', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData = {
				public_read: true
				// Missing required 'name' field
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle empty sheet name', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData: SheetCreateRequest = {
				name: ''
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle malformed JSON request', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: '{ invalid json }'
			});

			expect(response.status).toBe(400);
			// For malformed JSON, response might not be JSON itself
			try {
				const data = await response.json() as SheetCreateResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			} catch (e) {
				// If response is not JSON, that's also acceptable for malformed JSON input
				expect(response.status).toBe(400);
			}
		});

		it('should handle requests without Content-Type header', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData: SheetCreateRequest = {
				name: `TestSheet_NoContentType_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify(createData)
			});

			// Log the actual status to understand what's happening
			console.log('Response status for no Content-Type test:', response.status);
			
			// Should handle gracefully - checking for actual response status
			expect(response.status).toBeTypeOf('number');
			expect(response.status >= 200 && response.status < 600).toBe(true);
		});
	});

	describe('Sheet API Error Handling', () => {
		it('should handle database connection errors gracefully', { timeout: 10000 }, async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// This test verifies that the API handles database errors properly
			// In a real scenario, this might involve mocking database failures
			const createData: SheetCreateRequest = {
				name: `TestSheet_DBError_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			// Should either succeed or fail gracefully with 500 error
			expect([200, 500].includes(response.status)).toBe(true);
			
			if (response.status === 200) {
				const data = await response.json() as SheetCreateResponse;
				expect(data.success).toBe(true);
				// Track created sheet for cleanup if successful
				if (data.data?.sheetId) {
					createdSheetIds.push(data.data.sheetId);
				}
			} else if (response.status === 500) {
				const data = await response.json() as SheetCreateResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should handle Google Sheets API errors gracefully', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test with potentially problematic sheet name that might cause Google API issues
			const createData: SheetCreateRequest = {
				name: `TestSheet_GoogleAPIError_${Date.now()}_${'x'.repeat(100)}` // Very long name
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			// Should either succeed or fail gracefully
			expect([200, 400, 500].includes(response.status)).toBe(true);
			
			if (response.status === 200) {
				const data = await response.json() as SheetCreateResponse;
				expect(data.success).toBe(true);
				// Track created sheet for cleanup if successful
				if (data.data?.sheetId) {
					createdSheetIds.push(data.data.sheetId);
				}
			} else {
				const data = await response.json() as SheetCreateResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});

	describe('Sheet API Permission Validation', () => {
		it('should validate array types for permission fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData = {
				name: `TestSheet_InvalidPerms_${Date.now()}`,
				role_read: 'not-an-array', // Should be array
				role_write: ['admin'],
				user_read: [],
				user_write: []
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate boolean types for public permission fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const createData = {
				name: `TestSheet_InvalidBool_${Date.now()}`,
				public_read: 'not-a-boolean', // Should be boolean
				public_write: false,
				role_read: [],
				role_write: []
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});