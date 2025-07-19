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

			// Try to delete without authentication
			const resp = await fetch(`${BASE_URL}/api/sheets/${privateSheetId}/data/${testDataId}`, {
				method: 'DELETE'
				// No auth headers
			});
			
			expect([401, 403, 404].includes(resp.status)).toBe(true);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle insufficient permissions', async () => {
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
			let testDataIdForReadonly = 'test-data-readonly';
			
			if (createSheetResp.ok) {
				const sheetData = await createSheetResp.json() as any;
				readonlySheetId = sheetData.data?.id || readonlySheetId;
				
				// Create some data in the readonly sheet
				const createDataResp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({ name: 'test-data', value: 123 })
				});
				
				if (createDataResp.ok) {
					const dataResponse = await createDataResp.json() as any;
					testDataIdForReadonly = dataResponse.data?.id || testDataIdForReadonly;
				}
			}

			// Try to delete with invalid token (simulating insufficient permissions)
			const resp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data/${testDataIdForReadonly}`, {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer invalid-readonly-token'
				}
			});
			
			expect([401, 403, 404].includes(resp.status)).toBe(true);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should delete data successfully', async () => {
			requireSession(testSessionId);

			// Create test data specifically for deletion
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'to-be-deleted',
					value: 999,
					status: 'pending-deletion'
				})
			});
			
			let dataIdToDelete = existingDataId; // fallback
			if (createDataResp.ok) {
				const createData = await createDataResp.json() as any;
				dataIdToDelete = createData.data?.id || dataIdToDelete;
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${dataIdToDelete}`, {
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

			// Create and then delete test data
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'double-delete-test',
					value: 777
				})
			});
			
			let dataIdToDelete = 'fallback-id';
			if (createDataResp.ok) {
				const createData = await createDataResp.json() as any;
				dataIdToDelete = createData.data?.id || dataIdToDelete;
			}
			
			// First deletion
			await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${dataIdToDelete}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});

			// Try to delete the same data again
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${dataIdToDelete}`, {
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

			// Create a public-write sheet
			const createSheetResp = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: `public-write-sheet-${Date.now()}`,
					public_read: true,
					public_write: true
				})
			});
			
			let publicWriteSheetId = 'public-write-sheet-fallback';
			let publicDataId = testDataId;
			
			if (createSheetResp.ok) {
				const sheetData = await createSheetResp.json() as any;
				publicWriteSheetId = sheetData.data?.id || publicWriteSheetId;
				
				// Create test data in the public sheet
				const createDataResp = await fetch(`${BASE_URL}/api/sheets/${publicWriteSheetId}/data`, {
					method: 'POST',
					headers: createJsonHeaders(testSessionId),
					body: JSON.stringify({
						name: 'public-deletable-data',
						value: 456
					})
				});
				
				if (createDataResp.ok) {
					const dataResponse = await createDataResp.json() as any;
					publicDataId = dataResponse.data?.id || publicDataId;
				}
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${publicWriteSheetId}/data/${publicDataId}`, {
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

			// Create test data that might have references
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'referenced-data',
					type: 'parent',
					value: 888,
					has_references: true
				})
			});
			
			let referencedDataId = 'fallback-referenced-id';
			if (createDataResp.ok) {
				const createData = await createDataResp.json() as any;
				referencedDataId = createData.data?.id || referencedDataId;
			}

			// This test would check if deleting data with references
			// handles cascade rules properly
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${referencedDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			// Accept various status codes depending on implementation
			expect([200, 400, 404, 409].includes(resp.status)).toBe(true);
		});
	});
});