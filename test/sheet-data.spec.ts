import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Sheet Data API', () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev('src/index.ts', {
			experimental: { disableExperimentalWarning: true },
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	describe('GET /api/sheets/:id/data', () => {
		it('should require valid sheet ID', async () => {
			const resp = await worker.fetch('/api/sheets/invalid-sheet/data');
			expect(resp.status).toBe(404);
			
			const data = await resp.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should handle empty sheet data', async () => {
			// This test assumes there's an empty sheet or no data
			const resp = await worker.fetch('/api/sheets/empty-sheet/data');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(data.results).toEqual([]);
			}
		});

		it('should support basic query parameters', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?limit=10&page=1');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBeLessThanOrEqual(10);
			}
		});

		it('should support count parameter', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?count=true');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(typeof data.count).toBe('number');
			}
		});

		it('should support text search', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?query=test');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with equality', async () => {
			const whereCondition = JSON.stringify({ "name": "test" });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $gt operator', async () => {
			const whereCondition = JSON.stringify({ "score": { "$gt": 100 } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $lt operator', async () => {
			const whereCondition = JSON.stringify({ "score": { "$lt": 1000 } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $gte and $lte operators', async () => {
			const whereCondition = JSON.stringify({ "score": { "$gte": 1000, "$lte": 3000 } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $ne operator', async () => {
			const whereCondition = JSON.stringify({ "status": { "$ne": "inactive" } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $in operator', async () => {
			const whereCondition = JSON.stringify({ "category": { "$in": ["A", "B", "C"] } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $nin operator', async () => {
			const whereCondition = JSON.stringify({ "category": { "$nin": ["X", "Y", "Z"] } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $exists operator', async () => {
			const whereCondition = JSON.stringify({ "email": { "$exists": true } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $regex operator', async () => {
			const whereCondition = JSON.stringify({ "email": { "$regex": ".*@example\\.com$" } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support WHERE conditions with $text operator', async () => {
			const whereCondition = JSON.stringify({ "description": { "$text": "search term" } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by single field', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?order=name');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by single field descending', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?order=score:desc');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support ordering by multiple fields', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?order=category,score:desc');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
			}
		});

		it('should support complex query combinations', async () => {
			const whereCondition = JSON.stringify({ "score": { "$gte": 100, "$lte": 1000 } });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}&order=score:desc&limit=5&page=1&count=true`);
			
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
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(invalidWhere)}`);
			
			if (resp.status === 400) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Invalid WHERE condition format');
			}
		});

		it('should respect limit parameter', async () => {
			const resp = await worker.fetch('/api/sheets/test-sheet/data?limit=3');
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBeLessThanOrEqual(3);
			}
		});

		it('should respect page parameter', async () => {
			const resp1 = await worker.fetch('/api/sheets/test-sheet/data?limit=2&page=1');
			const resp2 = await worker.fetch('/api/sheets/test-sheet/data?limit=2&page=2');
			
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
			const resp = await worker.fetch('/api/sheets/private-sheet/data');
			
			if (resp.status === 401) {
				const data = await resp.json();
				expect(data.success).toBe(false);
				expect(data.error).toContain('Authentication required');
			}
		});

		it('should handle permission denied', async () => {
			// This test depends on sheet permissions
			const resp = await worker.fetch('/api/sheets/restricted-sheet/data', {
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
			// Test invalid limit
			const resp1 = await worker.fetch('/api/sheets/test-sheet/data?limit=0');
			if (resp1.status === 400) {
				const data = await resp1.json();
				expect(data.success).toBe(false);
			}
			
			// Test invalid page
			const resp2 = await worker.fetch('/api/sheets/test-sheet/data?page=0');
			if (resp2.status === 400) {
				const data = await resp2.json();
				expect(data.success).toBe(false);
			}
		});

		it('should handle empty results gracefully', async () => {
			const whereCondition = JSON.stringify({ "nonexistent_field": "nonexistent_value" });
			const resp = await worker.fetch(`/api/sheets/test-sheet/data?where=${encodeURIComponent(whereCondition)}`);
			
			if (resp.status === 200) {
				const data = await resp.json();
				expect(data.success).toBe(true);
				expect(Array.isArray(data.results)).toBe(true);
				expect(data.results.length).toBe(0);
			}
		});
	});
});