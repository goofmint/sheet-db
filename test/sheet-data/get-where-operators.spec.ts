import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	BASE_URL,
	createAuthHeaders,
	createJsonHeaders,
	requireSession
} from './helpers';

describe('Sheet Data GET API - WHERE Operators', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - WHERE Conditions', () => {
		it('should support WHERE conditions with equality', async () => {
			requireSession(testSessionId);

			// First create test data with known values
			const testData = [
				{ name: 'test', score: 100, status: 'active' },
				{ name: 'other', score: 200, status: 'active' },
				{ name: 'test', score: 150, status: 'inactive' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "name": "test" });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have name === 'test'
			for (const result of data.results) {
				expect(result.name).toBe('test');
			}
			// Should have found 2 records with name='test'
			expect(data.results.filter((r: any) => r.name === 'test').length).toBeGreaterThanOrEqual(2);
		});

		it('should support WHERE conditions with $gt operator', async () => {
			requireSession(testSessionId);

			// Create test data with known scores
			const testData = [
				{ name: 'low', score: 50 },
				{ name: 'medium', score: 100 },
				{ name: 'high', score: 150 },
				{ name: 'very-high', score: 200 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "score": { "$gt": 100 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have score > 100
			for (const result of data.results) {
				expect(result.score).toBeGreaterThan(100);
			}
			// Should have found at least 2 records with score > 100 (150 and 200)
			expect(data.results.filter((r: any) => r.score > 100).length).toBeGreaterThanOrEqual(2);
		});

		it('should support WHERE conditions with $lt operator', async () => {
			requireSession(testSessionId);

			// Create test data
			const testData = [
				{ name: 'low', score: 500 },
				{ name: 'high', score: 1500 },
				{ name: 'medium', score: 800 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "score": { "$lt": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have score < 1000
			for (const result of data.results) {
				expect(result.score).toBeLessThan(1000);
			}
			// Should not include the record with score=1500
			expect(data.results.every((r: any) => r.score !== 1500)).toBe(true);
		});

		it('should support WHERE conditions with $gte and $lte operators', async () => {
			requireSession(testSessionId);

			// Create test data with scores in and out of range
			const testData = [
				{ name: 'too-low', score: 500 },
				{ name: 'just-right-1', score: 1000 },
				{ name: 'just-right-2', score: 2000 },
				{ name: 'just-right-3', score: 3000 },
				{ name: 'too-high', score: 4000 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "score": { "$gte": 1000, "$lte": 3000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have score between 1000 and 3000 (inclusive)
			for (const result of data.results) {
				expect(result.score).toBeGreaterThanOrEqual(1000);
				expect(result.score).toBeLessThanOrEqual(3000);
			}
			// Should include exactly 3 records (1000, 2000, 3000)
			const scoresInRange = data.results.filter((r: any) => r.score >= 1000 && r.score <= 3000);
			expect(scoresInRange.length).toBeGreaterThanOrEqual(3);
		});

		it('should support WHERE conditions with $ne operator', async () => {
			requireSession(testSessionId);

			// Create test data with different statuses
			const testData = [
				{ name: 'active-1', status: 'active' },
				{ name: 'inactive-1', status: 'inactive' },
				{ name: 'pending-1', status: 'pending' },
				{ name: 'inactive-2', status: 'inactive' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "status": { "$ne": "inactive" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify no results have status === 'inactive'
			for (const result of data.results) {
				expect(result.status).not.toBe('inactive');
			}
			// Should not include any inactive records
			expect(data.results.filter((r: any) => r.status === 'inactive').length).toBe(0);
		});

		it('should support WHERE conditions with $in operator', async () => {
			requireSession(testSessionId);

			// Create test data with different categories
			const testData = [
				{ name: 'item-a', category: 'A' },
				{ name: 'item-b', category: 'B' },
				{ name: 'item-c', category: 'C' },
				{ name: 'item-d', category: 'D' },
				{ name: 'item-e', category: 'E' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "category": { "$in": ["A", "B", "C"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have category in ['A', 'B', 'C']
			for (const result of data.results) {
				expect(['A', 'B', 'C']).toContain(result.category);
			}
			// Should not include categories D and E
			expect(data.results.filter((r: any) => r.category === 'D' || r.category === 'E').length).toBe(0);
		});

		it('should support WHERE conditions with $nin operator', async () => {
			requireSession(testSessionId);

			// Create test data with different categories
			const testData = [
				{ name: 'item-a', category: 'A' },
				{ name: 'item-x', category: 'X' },
				{ name: 'item-y', category: 'Y' },
				{ name: 'item-z', category: 'Z' },
				{ name: 'item-b', category: 'B' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "category": { "$nin": ["X", "Y", "Z"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify no results have category in ['X', 'Y', 'Z']
			for (const result of data.results) {
				expect(['X', 'Y', 'Z']).not.toContain(result.category);
			}
			// Should only include categories not in the exclusion list
			expect(data.results.filter((r: any) => ['X', 'Y', 'Z'].includes(r.category)).length).toBe(0);
		});

		it('should support WHERE conditions with $exists operator', async () => {
			requireSession(testSessionId);

			// Create test data with and without email field
			const testData = [
				{ name: 'user-with-email', email: 'user@example.com' },
				{ name: 'user-no-email' },
				{ name: 'user-with-email-2', email: 'another@example.com' },
				{ name: 'user-empty-email', email: '' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "email": { "$exists": true } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have email field (even if empty)
			for (const result of data.results) {
				expect(result).toHaveProperty('email');
			}
			// Should include records with email field defined
			const withEmail = data.results.filter((r: any) => 'email' in r);
			expect(withEmail.length).toBeGreaterThanOrEqual(3);
		});

		it('should support WHERE conditions with $regex operator', async () => {
			requireSession(testSessionId);

			// Create test data with different email patterns
			const testData = [
				{ name: 'user1', email: 'user1@example.com' },
				{ name: 'user2', email: 'user2@test.com' },
				{ name: 'user3', email: 'admin@example.com' },
				{ name: 'user4', email: 'test@other.org' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "email": { "$regex": ".*@example\\.com$" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results have email ending with @example.com
			for (const result of data.results) {
				expect(result.email).toMatch(/@example\.com$/);
			}
			// Should include only @example.com emails
			const exampleEmails = data.results.filter((r: any) => r.email && r.email.endsWith('@example.com'));
			expect(exampleEmails.length).toBeGreaterThanOrEqual(2);
		});

		it('should support WHERE conditions with $text operator', async () => {
			requireSession(testSessionId);

			// Create test data with different descriptions
			const testData = [
				{ name: 'item1', description: 'This is a search term in the text' },
				{ name: 'item2', description: 'Another text without the phrase' },
				{ name: 'item3', description: 'Search term appears here too' },
				{ name: 'item4', description: 'Completely different content' }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "description": { "$text": "search term" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify all results contain 'search term' in description
			for (const result of data.results) {
				expect(result.description.toLowerCase()).toContain('search term');
			}
			// Should include at least 2 records with 'search term'
			const withSearchTerm = data.results.filter((r: any) => 
				r.description && r.description.toLowerCase().includes('search term')
			);
			expect(withSearchTerm.length).toBeGreaterThanOrEqual(2);
		});

		describe('Invalid WHERE conditions', () => {
			it('should return error for invalid JSON in WHERE parameter', async () => {
				requireSession(testSessionId);

				const invalidJson = '{invalid json}';
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(invalidJson)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toContain('Invalid WHERE');
			});

			it('should return error for invalid operator', async () => {
				requireSession(testSessionId);

				const whereCondition = JSON.stringify({ "score": { "$invalid": 100 } });
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toMatch(/invalid.*operator|unsupported.*operator/i);
			});

			it('should return error for invalid regex pattern', async () => {
				requireSession(testSessionId);

				const whereCondition = JSON.stringify({ "email": { "$regex": "[invalid regex" } });
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toMatch(/invalid.*regex|regex.*error/i);
			});

			it('should return error for invalid data type in operator', async () => {
				requireSession(testSessionId);

				// $gt expects a number, not an array
				const whereCondition = JSON.stringify({ "score": { "$gt": ["not", "a", "number"] } });
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toMatch(/invalid.*type|expected.*number/i);
			});

			it('should return error for $in operator without array', async () => {
				requireSession(testSessionId);

				const whereCondition = JSON.stringify({ "category": { "$in": "not-an-array" } });
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toMatch(/array.*required|expected.*array/i);
			});

			it('should return error for deeply nested invalid WHERE condition', async () => {
				requireSession(testSessionId);

				const whereCondition = JSON.stringify({ 
					"$and": [
						{ "score": { "$gt": 100 } },
						{ "status": { "$invalidOp": "active" } }
					]
				});
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
					headers: createAuthHeaders(testSessionId)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			});
		});
	});
});