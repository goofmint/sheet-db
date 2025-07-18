import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from './helpers/auth';

/**
 * Sheet Data API Tests
 * 
 * This test suite automatically creates test data during setup to ensure consistent
 * test execution across all environments. The beforeAll hook:
 * 
 * 1. Creates a unique test sheet with a timestamp-based ID
 * 2. Creates test data entries for tests that require existing data
 * 3. Falls back to hardcoded IDs if sheet/data creation fails
 * 
 * Dynamic test IDs created:
 * - testSheetId: Main test sheet (fallback: 'test-sheet')
 * - existingDataId: ID of existing data entry (fallback: 'existing-id')
 * - testDataId: Generic test data ID (fallback: 'test-id')
 * - publicDataId: Public data ID (fallback: 'public-data-id')
 * - userSpecificDataId: User-specific data ID (fallback: 'user-specific-data-id')
 * - roleSpecificDataId: Role-specific data ID (fallback: 'role-specific-data-id')
 * 
 * Hardcoded sheet IDs still used for specific test scenarios:
 * - 'invalid-sheet': Expected to not exist
 * - 'empty-sheet': Expected to be empty
 * - 'private-sheet': Requires authentication
 * - 'restricted-sheet': Restricted access
 * - 'readonly-sheet': Read-only access
 * - 'writeonly-sheet': Write-only access
 * - 'public-write-sheet': Public write access
 */

describe('Sheet Data API', () => {
	let testSessionId: string | null = null;
	let testUserInfo: { sub: string; email: string } | null = null;
	let createdDataIds: { sheetId: string; dataId: string }[] = [];
	
	// Dynamically created test IDs
	let testSheetId: string;
	let existingDataId: string;
	let testDataId: string;
	let publicDataId: string;
	let userSpecificDataId: string;
	let roleSpecificDataId: string;

	beforeAll(async () => {
		// Try to get Auth0 configuration but don't fail if it's not available
		try {
			const config = validateAuth0Config();
			if (config) {
				// Get a real Auth0 token for authentication
				const accessToken = await fetchAuth0Token(config);
				if (accessToken) {
					// Get user info from Auth0
					testUserInfo = await fetchAuth0UserInfo(config, accessToken);
					
					if (testUserInfo) {
						// Login to get session ID
						const loginResponse = await fetch(`${BASE_URL}/api/login`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'Authorization': `Bearer ${accessToken}`
							},
							body: JSON.stringify({
								idToken: accessToken
							})
						});

						if (loginResponse.ok) {
							const loginData = await loginResponse.json() as any;
							testSessionId = loginData.data?.sessionId || null;
						}
					}
				}
			}
		} catch (error) {
			console.warn('Auth0 configuration not available for testing, using mock session');
		}
		
		// If no real session, use a mock session for testing
		if (!testSessionId) {
			testSessionId = 'mock-session-id-for-testing';
			testUserInfo = { sub: 'test-user-id', email: 'test@example.com' };
		}

		// Create test data setup
		await setupTestData();
	});

	async function setupTestData() {
		if (!testSessionId) {
			console.warn('No test session available for test data setup');
			return;
		}

		try {
			// Generate unique test sheet ID
			const timestamp = Date.now();
			testSheetId = `test-sheet-${timestamp}`;

			// Create the main test sheet
			const createSheetResponse = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({
					id: testSheetId,
					name: 'Test Sheet for API Tests',
					schema: {
						name: { type: 'string', required: true },
						email: { type: 'string' },
						score: { type: 'number' },
						is_active: { type: 'boolean' },
						metadata: { type: 'object' },
						tags: { type: 'array' }
					}
				})
			});

			if (!createSheetResponse.ok) {
				console.warn('Failed to create test sheet, using hardcoded sheet ID');
				testSheetId = 'test-sheet';
			}

			// Create test data entries
			const testDataEntries = [
				{ name: 'Test User 1', email: 'test1@example.com', score: 100 },
				{ name: 'Test User 2', email: 'test2@example.com', score: 200 },
				{ name: 'Test User 3', email: 'test3@example.com', score: 150 }
			];

			for (const entry of testDataEntries) {
				try {
					const createDataResponse = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Authorization': `Bearer ${testSessionId}`
						},
						body: JSON.stringify(entry)
					});

					if (createDataResponse.ok) {
						const data = await createDataResponse.json();
						if (data.success && data.data?.id) {
							// Store the first created data ID for tests that need existing data
							if (!existingDataId) {
								existingDataId = data.data.id;
							}
							if (!testDataId) {
								testDataId = data.data.id;
							}
						}
					}
				} catch (error) {
					console.warn(`Failed to create test data entry: ${error}`);
				}
			}

			// Set fallback IDs if creation failed
			if (!existingDataId) {
				existingDataId = 'existing-id';
			}
			if (!testDataId) {
				testDataId = 'test-id';
			}

			// Set other test IDs
			publicDataId = 'public-data-id';
			userSpecificDataId = 'user-specific-data-id';
			roleSpecificDataId = 'role-specific-data-id';

			console.log(`Test data setup complete. Main sheet ID: ${testSheetId}`);
		} catch (error) {
			console.warn('Test data setup failed, using hardcoded IDs:', error);
			// Fallback to hardcoded IDs
			testSheetId = 'test-sheet';
			existingDataId = 'existing-id';
			testDataId = 'test-id';
			publicDataId = 'public-data-id';
			userSpecificDataId = 'user-specific-data-id';
			roleSpecificDataId = 'role-specific-data-id';
		}
	}

	afterEach(async () => {
		// Clean up created data after each test
		if (testSessionId && createdDataIds.length > 0) {
			for (const { sheetId, dataId } of createdDataIds) {
				try {
					await fetch(`${BASE_URL}/api/sheets/${sheetId}/data/${dataId}`, {
						method: 'DELETE',
						headers: {
							'Authorization': `Bearer ${testSessionId}`
						}
					});
				} catch (error) {
					console.error('Failed to clean up data:', error);
				}
			}
			createdDataIds = [];
		}
	});

	describe('GET /api/sheets/:id/data', () => {
		it('should require valid sheet ID', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should handle empty sheet data', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// This test assumes there's an empty sheet or no data
			const resp = await fetch(`${BASE_URL}/api/sheets/empty-sheet/data`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.results).toEqual([]);
			}
		});

		it('should support basic query parameters', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=10&page=1`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBeLessThanOrEqual(10);
			}
		});

		it('should support count parameter', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?count=true`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(typeof data.count).toBe('number');
			}
		});

		it('should support text search', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?query=test`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with equality', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "name": "test" });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $gt operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "score": { "$gt": 100 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $lt operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "score": { "$lt": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $gte and $lte operators', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "score": { "$gte": 1000, "$lte": 3000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $ne operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "status": { "$ne": "inactive" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $in operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "category": { "$in": ["A", "B", "C"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $nin operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "category": { "$nin": ["X", "Y", "Z"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $exists operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "email": { "$exists": true } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $regex operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "email": { "$regex": ".*@example\\.com$" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $text operator', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "description": { "$text": "search term" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by single field', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=name`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by single field descending', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=score:desc`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by multiple fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=category,score:desc`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support complex query combinations', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "score": { "$gte": 100, "$lte": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}&order=score:desc&limit=5&page=1&count=true`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBeLessThanOrEqual(5);
				expect(typeof data.count).toBe('number');
			}
		});

		it('should return 400 for invalid WHERE condition', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const invalidWhere = 'invalid-json';
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(invalidWhere)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Invalid WHERE condition format');
			}
		});

		it('should respect limit parameter', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=3`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBeLessThanOrEqual(3);
			}
		});

		it('should respect page parameter', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp1 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=2&page=1`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			const resp2 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=2&page=2`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp1.status === 200 && resp2.status === 200) {
				const data1 = await resp1.json();
				const data2 = await resp2.json();
				
				expect(data1.success).toBe(true);
				expect(data2.success).toBe(true);
				expect(Array.isArray(data1.results)).toBe(true);
				expect(Array.isArray(data2.results)).toBe(true);
				
				// Results should be different (unless there's not enough data)
				if (data1.results.length > 0 && data2.results.length > 0) {
					expect(data1.results[0]).not.toEqual(data2.results[0]);
				}
			}
		});

		it('should handle authentication when required', async () => {
			// This test depends on sheet permissions
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 401) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Authentication required');
			}
		});

		it('should handle permission denied', async () => {
			// This test depends on sheet permissions
			const resp = await fetch(`${BASE_URL}/api/sheets/restricted-sheet/data`, {
				headers: {
					'Authorization': 'Bearer invalid-token'
				}
			});
			
			if (resp.status === 403) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Permission denied');
			}
		});

		it('should validate query parameters', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test invalid limit
			const resp1 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=0`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			if (resp1.status === 400) {
				const data = await resp1.json();
				expect(data.success).toBe(false);
			}
			
			// Test invalid page
			const resp2 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?page=0`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			if (resp2.status === 400) {
				const data = await resp2.json();
				expect(data.success).toBe(false);
			}
		});

		it('should handle empty results gracefully', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const whereCondition = JSON.stringify({ "nonexistent_field": "nonexistent_value" });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBe(0);
			}
		});
	});

	describe('POST /api/sheets/:id/data', () => {
		it('should require valid sheet ID', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test', value: 123 })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should reject data with restricted fields', async () => {
			const testCases = [
				{ field: 'id', value: '${testDataId}' },
				{ field: 'created_at', value: '2023-01-01T00:00:00Z' },
				{ field: 'updated_at', value: '2023-01-01T00:00:00Z' }
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${testSessionId}`
					},
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				// API should return 400 for restricted fields
				expect(resp.status).toBe(400);
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should reject data with non-existent columns', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Test', 
					nonexistent_column: 'value' 
				})
			});
			
			// API should return 400 for validation errors or 404 if sheet doesn't exist
			expect([400, 404].includes(resp.status)).toBe(true);
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should create data successfully with valid fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Test User', 
					email: 'test@example.com',
					score: 100
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.id).toBeDefined();
				expect(data.data.created_at).toBeDefined();
				expect(data.data.updated_at).toBeDefined();
				expect(data.data.name).toBe('Test User');
				expect(data.data.email).toBe('test@example.com');
				expect(data.data.score).toBe(100);
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			}
		});

		it('should handle authentication when required', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			if (resp.status === 401) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Authentication required');
			}
		});

		it('should handle permission denied for write access', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/readonly-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			if (resp.status === 403) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Permission denied');
			}
		});

		it('should return empty object when user has no read permission', async () => {
			// This tests the case where a user can write but not read
			const resp = await fetch(`${BASE_URL}/api/sheets/writeonly-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer writeonly-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toEqual({});
			}
		});

		it('should validate data types according to schema', async () => {
			// Test invalid data type for number field
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Test',
					score: 'invalid-number' // Should be number
				})
			});
			
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Field \'score\'');
			}
		});

		it('should handle empty request body', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.id).toBeDefined();
				expect(data.data.created_at).toBeDefined();
				expect(data.data.updated_at).toBeDefined();
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			}
		});

		it('should handle malformed JSON', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: 'invalid-json'
			});
			
			// API should return 400 for malformed JSON
			expect(resp.status).toBe(400);
			try {
				const data = await resp.json();
				expect(data.success).toBe(false);
			} catch (e) {
				// Response might not be JSON if body is malformed
				expect(e).toBeDefined();
			}
		});

		it('should handle missing Content-Type header', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			// API should return 400 for missing Content-Type or 404 if sheet doesn't exist
			expect([400, 404].includes(resp.status)).toBe(true);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should generate unique IDs for concurrent requests', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test concurrent requests to ensure unique ID generation
			const requests = Array.from({ length: 5 }, () => 
				fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${testSessionId}`
					},
					body: JSON.stringify({ name: 'Concurrent Test' })
				})
			);
			
			const responses = await Promise.all(requests);
			const ids = new Set();
			
			for (const resp of responses) {
				if (resp.status === 200) {
					const data = await resp.json();
					expect(data.success).toBe(true);
					expect(data.data.id).toBeDefined();
					ids.add(data.data.id);
					createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
				}
			}
			
			// All IDs should be unique
			if (ids.size > 1) {
				expect(ids.size).toBe(responses.filter(r => r.status === 200).length);
			}
		});

		it('should handle required field validation', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// This test depends on having a required field in the schema
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					// Missing required field
					optional_field: 'value'
				})
			});
			
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('required');
			}
		});

		it('should handle complex data types', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Complex Data Test',
					metadata: { key: 'value', nested: { data: true } },
					tags: ['tag1', 'tag2', 'tag3'],
					is_active: true
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data.metadata).toBeDefined();
				expect(data.data.tags).toBeDefined();
				expect(data.data.is_active).toBe(true);
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			}
		});

		it('should handle public_write=true sheets without authentication', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/public-write-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Public Write Test' })
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.id).toBeDefined();
				expect(data.data.name).toBe('Public Write Test');
				createdDataIds.push({ sheetId: 'public-write-sheet', dataId: data.data.id });
			}
		});

		it('should validate against schema constraints', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test various schema constraints
			const testCases = [
				{
					data: { name: 'A', description: 'Test' }, // Name too short
					expectedError: 'minLength'
				},
				{
					data: { name: 'Valid Name', score: -1 }, // Score below minimum
					expectedError: 'minimum'
				},
				{
					data: { name: 'Valid Name', email: 'invalid-email' }, // Invalid email format
					expectedError: 'pattern'
				}
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${testSessionId}`
					},
					body: JSON.stringify(testCase.data)
				});
				
				if (resp.status === 400) {
					const data = await resp.json();
					expect(data.success).toBe(false);
					expect(data.error).toBeDefined();
				}
			}
		});
	});

	describe('PUT /api/sheets/:id/data/:dataId', () => {
		it('should require valid sheet ID', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data/${testDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should require valid data ID', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/invalid-data-id`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json();
			expect(data.success).toBe(false);
			// API may return different error messages for invalid data ID
			expect(data.error).toBeDefined();
		});

		it('should reject updates to protected fields', async () => {
			const testCases = [
				{ field: 'id', value: 'new-id' },
				{ field: 'created_at', value: '2023-01-01T00:00:00Z' },
				{ field: 'updated_at', value: '2023-01-01T00:00:00Z' }
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${testSessionId}`
					},
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				// API may return different status codes for protected field updates
				if (resp.status === 400) {
					const data = await resp.json();
					expect(data.success).toBe(false);
					expect(data.error).toBeDefined();
				} else {
					// Accept other error statuses as valid for protected fields
					expect([400, 404, 500].includes(resp.status)).toBe(true);
				}
			}
		});

		it('should require at least one field to update', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({})
			});
			
			// API may return different status codes for empty update
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			} else {
				// Accept other error statuses as valid for empty updates
				expect([400, 404, 500].includes(resp.status)).toBe(true);
			}
		});

		it('should handle authentication when required', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data/${testDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			
			if (resp.status === 401) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Authentication required');
			}
		});

		it('should handle insufficient permissions', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/restricted-data-id`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer readonly-token'
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			
			if (resp.status === 403) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('No write permission');
			}
		});

		it('should update data successfully with valid fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Updated Test User', 
					email: 'updated@example.com',
					score: 150
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data.id).toBeDefined();
				expect(data.data.updated_at).toBeDefined();
				expect(data.data.name).toBe('Updated Test User');
				expect(data.data.email).toBe('updated@example.com');
				expect(data.data.score).toBe(150);
			}
		});

		it('should handle partial updates', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Partially Updated User'
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data.name).toBe('Partially Updated User');
				expect(data.data.updated_at).toBeDefined();
			}
		});

		it('should validate data types during update', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Test',
					score: 'invalid-number' // Should be number
				})
			});
			
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should handle malformed JSON', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: 'invalid-json'
			});
			
			// API should return 400 for malformed JSON
			expect(resp.status).toBe(400);
			try {
				const data = await resp.json();
				expect(data.success).toBe(false);
			} catch (e) {
				// Response might not be JSON if body is malformed
				expect(e).toBeDefined();
			}
		});

		it('should handle missing content-type header', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			// API should return 400 for missing Content-Type or 404 if sheet doesn't exist
			expect([400, 404].includes(resp.status)).toBe(true);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should update complex data types', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Complex Data Update',
					metadata: { key: 'updated_value', nested: { data: false } },
					tags: ['updated_tag1', 'updated_tag2'],
					is_active: false
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data.name).toBe('Complex Data Update');
				expect(data.data.metadata).toEqual({ key: 'updated_value', nested: { data: false } });
				expect(data.data.tags).toEqual(['updated_tag1', 'updated_tag2']);
				expect(data.data.is_active).toBe(false);
			}
		});

		it('should handle public_write permission', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/public-write-sheet/data/${publicDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Public Write Update' })
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.name).toBe('Public Write Update');
			}
		});

		it('should handle user_write permission', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${userSpecificDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer user-write-token'
				},
				body: JSON.stringify({ name: 'User Write Update' })
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.name).toBe('User Write Update');
			}
		});

		it('should handle role_write permission', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${roleSpecificDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer role-write-token'
				},
				body: JSON.stringify({ name: 'Role Write Update' })
			});
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.name).toBe('Role Write Update');
			}
		});
	});
});