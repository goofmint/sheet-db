import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	testDataId,
	BASE_URL,
	createAuthHeaders,
	createJsonHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data POST API - Validation', () => {
	setupSheetDataTests();

	describe('POST /api/sheets/:id/data - Input Validation', () => {
		it('should require valid sheet ID', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test', value: 123 })
			});
			expect(resp.status).toBe(404);
			
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should reject data with restricted fields', async () => {
			const testCases = [
				{ field: 'id', value: testDataId },
				{ field: 'created_at', value: '2023-01-01T00:00:00Z' },
				{ field: 'updated_at', value: '2023-01-01T00:00:00Z' }
			];

			for (const testCase of testCases) {
				const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ [testCase.field]: testCase.value, name: 'Test' })
				});
				
				// API should return 400 for restricted fields
				expect(resp.status).toBe(400);
				const data = await resp.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should reject data with non-existent columns', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Test', 
					nonexistent_column: 'value' 
				})
			});
			
			// API should return 400 for validation errors or 404 if sheet doesn't exist
			expect([400, 404].includes(resp.status)).toBe(true);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate data types according to schema', async () => {
			// Test invalid data type for number field
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Test',
					score: 'invalid-number' // Should be number
				})
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Field \'score\'');
		});

		it('should handle malformed JSON', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: 'invalid-json'
			});
			
			// API should return 400 for malformed JSON
			expect(resp.status).toBe(400);
			try {
				const data = await resp.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
			} catch (e) {
				// Response might not be JSON if body is malformed
				expect(e).toBeDefined();
			}
		});

		it('should handle missing Content-Type header', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createAuthHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test' })
			});
			
			// API should return 400 for missing Content-Type or 404 if sheet doesn't exist
			expect([400, 404].includes(resp.status)).toBe(true);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
		});

		it('should handle required field validation', async () => {
			requireSession(testSessionId);

			// This test depends on having a required field in the schema
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					// Missing required field
					optional_field: 'value'
				})
			});
			
			expect(resp.status).toBe(400);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('required');
		});

		it('should validate against schema constraints', async () => {
			requireSession(testSessionId);

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
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify(testCase.data)
				});
				
				expect(resp.status).toBe(400);
				const data = await resp.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});