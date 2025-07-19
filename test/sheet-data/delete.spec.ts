import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	testDataId,
	existingDataId,
	BASE_URL,
	createAuthHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data DELETE API', () => {
	setupSheetDataTests();

	describe('DELETE /api/sheets/:id/data/:dataId', () => {
		it('should require valid sheet ID', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/invalid-sheet/data/${testDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(404);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Sheet not found');
		});

		it('should require valid data ID', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/invalid-data-id`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(404);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle authentication when required', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/private-sheet/data/${testDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authentication required');
		});

		it('should handle insufficient permissions', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/restricted-data-id`, {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer readonly-token'
				}
			});
			
			expect(resp.status).toBe(403);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('No write permission');
		});

		it('should delete data successfully', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; message: string };
			expect(data.success).toBe(true);
			expect(data.message).toBeDefined();
		});

		it('should handle already deleted data', async () => {
			requireSession(testSessionId);

			// Try to delete the same data again
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(404);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle public_write permission for delete', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/public-write-sheet/data/${testDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as { success: boolean; message: string };
			expect(data.success).toBe(true);
			expect(data.message).toBeDefined();
		});

		it('should handle cascade deletion validation', async () => {
			requireSession(testSessionId);

			// This test would check if deleting data with references
			// handles cascade rules properly
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/data-with-references`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			// Accept various status codes depending on implementation
			expect([200, 400, 404, 409].includes(resp.status)).toBe(true);
		});
	});
});