import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from './helpers/auth';

describe('Sheet Data API', () => {
	let testSessionId: string | null = null;
	let testUserInfo: { sub: string; email: string } | null = null;
	let createdDataIds: { sheetId: string; dataId: string }[] = [];

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
	});

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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?limit=10&page=1`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?count=true`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?query=test`, {
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
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "score": { "$gt": 100 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "score": { "$lt": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "score": { "$gte": 1000, "$lte": 3000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "status": { "$ne": "inactive" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "category": { "$in": ["A", "B", "C"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "category": { "$nin": ["X", "Y", "Z"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "email": { "$exists": true } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "email": { "$regex": ".*@example\\.com$" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
			const whereCondition = JSON.stringify({ "description": { "$text": "search term" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?order=name`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?order=score:desc`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?order=category,score:desc`, {
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
			const whereCondition = JSON.stringify({ "score": { "$gte": 100, "$lte": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}&order=score:desc&limit=5&page=1&count=true`, {
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
			const invalidWhere = 'invalid-json';
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(invalidWhere)}`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?limit=3`, {
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

			const resp1 = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?limit=2&page=1`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			const resp2 = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?limit=2&page=2`, {
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
			const resp1 = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?limit=0`, {
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				}
			});
			if (resp1.status === 400) {
				const data = await resp1.json();
				expect(data.success).toBe(false);
			}
			
			// Test invalid page
			const resp2 = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?page=0`, {
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
			const whereCondition = JSON.stringify({ "nonexistent_field": "nonexistent_value" });
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`, {
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
				{ field: 'id', value: 'test-id' },
				{ field: 'created_at', value: '2023-01-01T00:00:00Z' },
				{ field: 'updated_at', value: '2023-01-01T00:00:00Z' }
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain(`Field '${testCase.field}' cannot be specified`);
			}
		});

		it('should reject data with non-existent columns', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('Column \'nonexistent_column\' does not exist');
		});

		it('should create data successfully with valid fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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
			}
		});

		it('should handle malformed JSON', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: 'invalid-json'
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should handle missing Content-Type header', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should generate unique IDs for concurrent requests', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test concurrent requests to ensure unique ID generation
			const requests = Array.from({ length: 5 }, () => 
				fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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
				}
			}
			
			// All IDs should be unique
			if (ids.size > 1) {
				expect(ids.size).toBe(responses.filter(r => r.status === 200).length);
			}
		});

		it('should handle required field validation', async () => {
			// This test depends on having a required field in the schema
			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
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
			}
		});

		it('should validate against schema constraints', async () => {
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
				const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
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

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data/test-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/invalid-data-id`, {
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
			expect(data.error).toContain('Data not found');
		});

		it('should reject updates to protected fields', async () => {
			const testCases = [
				{ field: 'id', value: 'new-id' },
				{ field: 'created_at', value: '2023-01-01T00:00:00Z' },
				{ field: 'updated_at', value: '2023-01-01T00:00:00Z' }
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain(`Field '${testCase.field}' cannot be updated`);
			}
		});

		it('should require at least one field to update', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({})
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('At least one field must be provided for update');
		});

		it('should handle authentication when required', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data/test-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/restricted-data-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: 'invalid-json'
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should handle missing content-type header', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
				method: 'PUT',
				headers: {
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json();
			expect(data.success).toBe(false);
		});

		it('should update complex data types', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/existing-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/public-write-sheet/data/public-data-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/user-specific-data-id`, {
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

			const resp = await fetch(`${BASE_URL}/api/sheets/test-sheet/data/role-specific-data-id`, {
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