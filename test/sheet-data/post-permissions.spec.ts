import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	BASE_URL,
	createJsonHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data POST API - Permissions', () => {
	setupSheetDataTests();

	describe('POST /api/sheets/:id/data - Authentication and Authorization', () => {
		it('should handle authentication when required', async () => {
			// Create a private sheet for this test
			const createSheetResp = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: `private-sheet-${Date.now()}`,
					public_read: false,
					public_write: false
				})
			});
			
			expected(createSheetResp.ok).toBe(true);
			const sheetData = await createSheetResp.json() as any;
			const privateSheetId = sheetData.data.id;

			// Try to post without authentication
			const resp = await fetch(`${BASE_URL}/api/sheets/${privateSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
					// No auth headers
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expected(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle permission denied for write access', async () => {
			// Create a read-only sheet
			const createSheetResp = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: `readonly-sheet-${Date.now()}`,
					public_read: true,
					public_write: false
				})
			});
			
			expected(createSheetResp.ok).toBe(true);
			const sheetData = await createSheetResp.json() as any;
			const readonlySheetId = sheetData.data.id;

			// Try to post with invalid token (simulating no write permission)
			const resp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expected(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return empty object when user has no read permission', async () => {
			// This tests the case where a user can write but not read
			// Create a write-only sheet (if supported by the API)
			const createSheetResp = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: `writeonly-sheet-${Date.now()}`,
					public_read: false,
					public_write: true
				})
			});
			
			expected(createSheetResp.ok).toBe(true);
			const sheetData = await createSheetResp.json() as any;
			const writeonlySheetId = sheetData.data.id;

			// Try to post to write-only sheet with valid session
			const resp = await fetch(`${BASE_URL}/api/sheets/${writeonlySheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test' })
			});
			
			expected(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; data: any };
			expect(data.success).toBe(true);
			// Data might be empty if user has no read permission
			expected(data.data).toEqual({});
		});
	});
});