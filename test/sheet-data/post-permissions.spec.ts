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
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authentication required');
		});

		it('should handle permission denied for write access', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/readonly-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(403);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Permission denied');
		});

		it('should return empty object when user has no read permission', async () => {
			// This tests the case where a user can write but not read
			const resp = await fetch(`${BASE_URL}/api/sheets/writeonly-sheet/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer writeonly-token'
				},
				body: JSON.stringify({ name: 'Test' })
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; data: {} };
			expect(data.success).toBe(true);
			expect(data.data).toEqual({});
		});
	});
});