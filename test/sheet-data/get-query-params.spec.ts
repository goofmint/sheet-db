import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	BASE_URL,
	createAuthHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data GET API - Query Parameters', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - Query Parameters', () => {
		it('should support basic query parameters', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=10&page=1`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.results.length).toBeLessThanOrEqual(10);
		});

		it('should support count parameter', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?count=true`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[]; count: number };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			expect(typeof data.count).toBe('number');
		});

		it('should support text search', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?query=test`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should respect limit parameter', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=3`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.results.length).toBeLessThanOrEqual(3);
		});

		it('should respect page parameter', async () => {
			requireSession(testSessionId);

			const resp1 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=2&page=1`, {
				headers: createAuthHeaders(testSessionId)
			});
			const resp2 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=2&page=2`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp1.status).toBe(200);
			expect(resp2.status).toBe(200);
			const data1 = await resp1.json() as { success: boolean; results: any[] };
			const data2 = await resp2.json() as { success: boolean; results: any[] };
			
			expect(data1.success).toBe(true);
			expect(data2.success).toBe(true);
			expect(Array.isArray(data1.results)).toBe(true);
			expect(Array.isArray(data2.results)).toBe(true);
			
			// Page 1 and page 2 should be accessible
			// Note: Results may be empty if there's insufficient data
		});

		it('should return 400 for invalid WHERE condition', async () => {
			requireSession(testSessionId);

			const invalidWhere = 'invalid-json';
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(invalidWhere)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Invalid WHERE condition format');
		});
	});
});