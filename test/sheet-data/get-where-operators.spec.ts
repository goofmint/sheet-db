import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	BASE_URL,
	createAuthHeaders,
	requireSession
} from './helpers';

describe('Sheet Data GET API - WHERE Operators', () => {
	setupSheetDataTests();

	describe('GET /api/sheets/:id/data - WHERE Conditions', () => {
		it('should support WHERE conditions with equality', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "name": "test" });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $gt operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "score": { "$gt": 100 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $lt operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "score": { "$lt": 1000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $gte and $lte operators', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "score": { "$gte": 1000, "$lte": 3000 } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $ne operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "status": { "$ne": "inactive" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $in operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "category": { "$in": ["A", "B", "C"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $nin operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "category": { "$nin": ["X", "Y", "Z"] } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $exists operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "email": { "$exists": true } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $regex operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "email": { "$regex": ".*@example\\.com$" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});

		it('should support WHERE conditions with $text operator', async () => {
			requireSession(testSessionId);

			const whereCondition = JSON.stringify({ "description": { "$text": "search term" } });
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data?where=${encodeURIComponent(whereCondition)}`, {
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; results: any[] };
			expect(data.success).toBe(true);
			expect(Array.isArray(data.results)).toBe(true);
		});
	});
});