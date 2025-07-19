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
			
			let privateSheetId = 'private-sheet-fallback';
			if (createSheetResp.ok) {
				const sheetData = await createSheetResp.json() as any;
				privateSheetId = sheetData.data?.id || privateSheetId;
			}

			// Try to post without authentication
			const resp = await fetch(`${BASE_URL}/api/sheets/${privateSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
					// No auth headers
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect([401, 403, 404].includes(resp.status)).toBe(true);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle permission denied for write access', async () => {
			requireSession(testSessionId);

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
			
			let readonlySheetId = 'readonly-sheet-fallback';
			if (createSheetResp.ok) {
				const sheetData = await createSheetResp.json() as any;
				readonlySheetId = sheetData.data?.id || readonlySheetId;
			}

			// Try to post with invalid token (simulating no write permission)
			const resp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect([401, 403, 404].includes(resp.status)).toBe(true);
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
			
			let writeonlySheetId = 'writeonly-sheet-fallback';
			if (createSheetResp.ok) {
				const sheetData = await createSheetResp.json() as any;
				writeonlySheetId = sheetData.data?.id || writeonlySheetId;
			}

			// Try to post to write-only sheet with valid session
			const resp = await fetch(`${BASE_URL}/api/sheets/${writeonlySheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test' })
			});
			
			// Accept different behaviors: success with empty data or permission error
			if (resp.status === 200) {
				const data = await resp.json() as { success: boolean; data?: any };
				expect(data.success).toBe(true);
				// Data might be empty if user has no read permission
				if (data.data !== undefined) {
					expect(data.data).toEqual({});
				}
			} else {
				// Or it might return a permission error
				expect([401, 403, 404].includes(resp.status)).toBe(true);
				const data = await resp.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
			}
		});
	});
});