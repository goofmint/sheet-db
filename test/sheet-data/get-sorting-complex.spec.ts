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

describe('Sheet Data GET API - Sorting and Complex Queries', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - Sorting and Complex Operations', () => {
		it('should support ordering by single field', async () => {
			requireSession(testSessionId);

			// Create test data with known names for sorting
			const testData = [
				{ name: 'zebra', score: 100 },
				{ name: 'apple', score: 200 },
				{ name: 'banana', score: 150 },
				{ name: 'cherry', score: 175 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=name`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify sorting by name (ascending)
			const sortedResults = data.results.filter(r => r.name && ['apple', 'banana', 'cherry', 'zebra'].includes(r.name));
			expect(sortedResults.length).toBeGreaterThanOrEqual(4);
			
			// Check that results are sorted alphabetically
			for (let i = 1; i < sortedResults.length; i++) {
				expect(sortedResults[i].name >= sortedResults[i-1].name).toBe(true);
			}
		});

		it('should support ordering by single field descending', async () => {
			requireSession(testSessionId);

			// Create test data with distinct scores
			const testData = [
				{ name: 'item1', score: 100 },
				{ name: 'item2', score: 300 },
				{ name: 'item3', score: 200 },
				{ name: 'item4', score: 400 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=score:desc`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify sorting by score (descending)
			const sortedResults = data.results.filter(r => r.score && [100, 200, 300, 400].includes(r.score));
			expect(sortedResults.length).toBeGreaterThanOrEqual(4);
			
			// Check that results are sorted in descending order
			for (let i = 1; i < sortedResults.length; i++) {
				expect(sortedResults[i].score <= sortedResults[i-1].score).toBe(true);
			}
		});

		it('should support ordering by multiple fields', async () => {
			requireSession(testSessionId);

			// Create test data with same categories but different scores
			const testData = [
				{ name: 'item1', category: 'B', score: 100 },
				{ name: 'item2', category: 'A', score: 300 },
				{ name: 'item3', category: 'B', score: 200 },
				{ name: 'item4', category: 'A', score: 100 },
				{ name: 'item5', category: 'C', score: 150 }
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=category,score:desc`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify multi-field sorting (category asc, then score desc)
			const sortedResults = data.results.filter(r => 
				r.category && ['A', 'B', 'C'].includes(r.category) && 
				r.score && [100, 150, 200, 300].includes(r.score)
			);
			expect(sortedResults.length).toBeGreaterThanOrEqual(5);
			
			// Check that categories are sorted first, then scores within categories
			for (let i = 1; i < sortedResults.length; i++) {
				const prev = sortedResults[i-1];
				const curr = sortedResults[i];
				
				// Primary sort: category should be in ascending order
				expect(curr.category >= prev.category).toBe(true);
				// Secondary sort: within same category, score should be descending
				if (prev.category === curr.category) {
					expect(curr.score <= prev.score).toBe(true);
				}
			}
		});

		it('should support complex query combinations', async () => {
			requireSession(testSessionId);

			// Create test data with scores in and out of range
			const testData = [
				{ name: 'low-score', score: 50 },     // out of range
				{ name: 'item1', score: 100 },        // in range
				{ name: 'item2', score: 200 },        // in range
				{ name: 'item3', score: 300 },        // in range
				{ name: 'item4', score: 400 },        // in range
				{ name: 'item5', score: 500 },        // in range
				{ name: 'item6', score: 600 },        // in range
				{ name: 'item7', score: 700 },        // in range
				{ name: 'item8', score: 800 },        // in range
				{ name: 'item9', score: 900 },        // in range
				{ name: 'item10', score: 1000 },      // in range
				{ name: 'high-score', score: 1500 }   // out of range
			];
			
			for (const item of testData) {
				await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(item)
				});
			}

			const whereCondition = JSON.stringify({ "score": { "$gte": 100, "$lte": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}&order=score:desc&limit=5&page=1&count=true`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[]; count: number; pagination?: any };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			
			// Verify pagination limit is enforced
			expect(data.results.length).toBeLessThanOrEqual(5);
			
			// Verify all results are within the score range
			for (const result of data.results) {
				expect(result.score).toBeGreaterThanOrEqual(100);
				expect(result.score).toBeLessThanOrEqual(1000);
			}
			
			// Verify results are sorted by score in descending order
			const filteredResults = data.results.filter(r => r.score >= 100 && r.score <= 1000);
			for (let i = 1; i < filteredResults.length; i++) {
				expect(filteredResults[i].score <= filteredResults[i-1].score).toBe(true);
			}
			
			// Verify count represents total matching records (not just current page)
			expect(typeof data.count).toBe('number');
			expect(data.count).toBeGreaterThanOrEqual(data.results.length);
			// Should have at least 10 records in range (100-1000)
			expect(data.count).toBeGreaterThanOrEqual(10);
			
			// Verify pagination metadata exists
			expect(data.pagination).toBeDefined();
			expect(data.pagination.page).toBe(1);
			expect(data.pagination.limit).toBe(5);
			expect(data.pagination.total).toBe(data.count);
		});
	});
});