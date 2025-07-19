import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	BASE_URL,
	createAuthHeaders,
	createJsonHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data GET API - Basic Operations', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - Basic Validation', () => {
		it('should require valid sheet ID', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data`, {
				headers: createAuthHeaders(testSessionId)
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it.skip('should handle empty sheet data', async () => {
			requireSession(testSessionId);

			// This test assumes there's an empty sheet or no data
			const resp = await fetch(`${BASE_URL}/api/sheets/empty-sheet/data`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(data.results).toEqual([]);
		});

		it.skip('should handle authentication when required', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authentication required');
		});

		it.skip('should handle permission denied', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/restricted-sheet/data`, {
				headers: { 'Authorization': 'Bearer invalid-token' }
			});
			
			expect(resp.status).toBe(403);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Permission denied');
		});

		it('should validate query parameters', async () => {
			requireSession(testSessionId);

			// Test invalid limit
			const resp1 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?limit=0`, {
				headers: createAuthHeaders(testSessionId)
			});
			expect(resp1.status).toBe(400);
			const data1 = await resp1.json() as ApiErrorResponse;
			expect(data1.success).toBe(false);
			
			// Test invalid page
			const resp2 = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?page=0`, {
				headers: createAuthHeaders(testSessionId)
			});
			expect(resp2.status).toBe(400);
			const data2 = await resp2.json() as ApiErrorResponse;
			expect(data2.success).toBe(false);
		});

		it('should handle empty results gracefully', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "nonexistent_field": "nonexistent_value" });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
			expect(data.results.length).toBe(0);
		});
	});
});