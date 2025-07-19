import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	testDataId,
	existingDataId,
	BASE_URL,
	createAuthHeaders,
	createJsonHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data PUT API - Validation', () => {
	setupSheetDataTests();

	describe('PUT /api/sheets/:id/data/:dataId - Input Validation', () => {
		it('should require valid sheet ID', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data/${testDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Updated Test' })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should require valid data ID', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/invalid-data-id`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Updated Test' })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json() as ApiErrorResponse;
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
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should require at least one field to update', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({})
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate data types during update', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Test',
					score: 'invalid-number' // Should be number
				})
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle malformed JSON', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: 'invalid-json'
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
		});

		it('should handle missing content-type header', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createAuthHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
		});
	});
});