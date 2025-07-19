import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	BASE_URL,
	createAuthHeaders,
	requireSession
} from './helpers';

describe('Sheet Data GET API - Sorting and Complex Queries', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - Sorting and Complex Operations', () => {
		it('should support ordering by single field', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=name`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support ordering by single field descending', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=score:desc`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support ordering by multiple fields', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?order=category,score:desc`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support complex query combinations', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "score": { "$gte": 100, "$lte": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}&order=score:desc&limit=5&page=1&count=true`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[]; count: number };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.results.length).toBeLessThanOrEqual(5);
			expect(typeof data.count).toBe('number');
		});
	});
});