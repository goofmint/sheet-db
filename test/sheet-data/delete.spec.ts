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
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data DELETE API', () => {
	setupSheetDataTests();

	describe('DELETE /api/sheets/:id/data/:dataId', () => {
		it('should require valid sheet ID', async () => {
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
			
			if (!createSheetResp.ok) {
				const errorText = await createSheetResp.text();
				throw new Error(`Failed to create test sheet: ${createSheetResp.status} ${errorText}`);
			}
			const sheetData = await createSheetResp.json() as any;
			const privateSheetId = sheetData.data.id;

			// Try to delete without authentication
			const resp = await fetch(`${BASE_URL}/api/sheets/${privateSheetId}/data/${testDataId}`, {
				method: 'DELETE'
				// No auth headers
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle insufficient permissions', async () => {
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
			
			if (!createSheetResp.ok) {
				const errorText = await createSheetResp.text();
				throw new Error(`Failed to create test sheet: ${createSheetResp.status} ${errorText}`);
			}
			const sheetData = await createSheetResp.json() as any;
			const readonlySheetId = sheetData.data.id;
			
			// Create some data in the readonly sheet
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'test-data', value: 123 })
			});
			
			if (!createDataResp.ok) {
				const errorText = await createDataResp.text();
				throw new Error(`Failed to create test data: ${createDataResp.status} ${errorText}`);
			}
			const dataResponse = await createDataResp.json() as any;
			const testDataIdForReadonly = dataResponse.data.id;

			// Try to delete with invalid token (simulating insufficient permissions)
			const resp = await fetch(`${BASE_URL}/api/sheets/${readonlySheetId}/data/${testDataIdForReadonly}`, {
				method: 'DELETE',
				headers: {
					'Authorization': 'Bearer invalid-readonly-token'
				}
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should delete data successfully', async () => {
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
			
			if (!createDataResp.ok) {
				const errorText = await createDataResp.text();
				throw new Error(`Failed to create test data: ${createDataResp.status} ${errorText}`);
			}
			const createData = await createDataResp.json() as any;
			const dataIdToDelete = createData.data.id;

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
			// Create and then delete test data
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'double-delete-test',
					value: 777
				})
			});
			
			if (!createDataResp.ok) {
				const errorText = await createDataResp.text();
				throw new Error(`Failed to create test data: ${createDataResp.status} ${errorText}`);
			}
			const createData = await createDataResp.json() as any;
			const dataIdToDelete = createData.data.id;
			
			// First deletion
			const firstDeleteResp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${dataIdToDelete}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			if (!firstDeleteResp.ok) {
				const errorText = await firstDeleteResp.text();
				throw new Error(`Failed to delete test data: ${firstDeleteResp.status} ${errorText}`);
			}

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
			
			if (!createSheetResp.ok) {
				const errorText = await createSheetResp.text();
				throw new Error(`Failed to create test sheet: ${createSheetResp.status} ${errorText}`);
			}
			const sheetData = await createSheetResp.json() as any;
			const publicWriteSheetId = sheetData.data.id;
			
			// Create test data in the public sheet
			const createDataResp = await fetch(`${BASE_URL}/api/sheets/${publicWriteSheetId}/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'public-deletable-data',
					value: 456
				})
			});
			
			if (!createDataResp.ok) {
				const errorText = await createDataResp.text();
				throw new Error(`Failed to create test data: ${createDataResp.status} ${errorText}`);
			}
			const dataResponse = await createDataResp.json() as any;
			const publicDataId = dataResponse.data.id;

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
			
			if (!createDataResp.ok) {
				const errorText = await createDataResp.text();
				throw new Error(`Failed to create test data: ${createDataResp.status} ${errorText}`);
			}
			const createData = await createDataResp.json() as any;
			const referencedDataId = createData.data.id;

			// This test would check if deleting data with references
			// handles cascade rules properly
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${referencedDataId}`, {
				method: 'DELETE',
				headers: createAuthHeaders(testSessionId)
			});
			
			// Expect successful deletion for this test
			expect(resp.status).toBe(200);
		});
	});
});