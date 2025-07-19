import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	testDataId,
	publicDataId,
	userSpecificDataId,
	roleSpecificDataId,
	BASE_URL,
	createJsonHeaders,
	requireSession,
	type ApiErrorResponse 
} from './helpers';

describe('Sheet Data PUT API - Permissions', () => {
	setupSheetDataTests();

	describe('PUT /api/sheets/:id/data/:dataId - Authentication and Authorization', () => {
		it('should handle authentication when required', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${testDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
					// No auth headers
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authentication required');
		});

		it('should handle insufficient permissions', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${testDataId}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-token'
				},
				body: JSON.stringify({ name: 'Updated Test' })
			});
			
			expect(resp.status).toBe(401);
			const data = await resp.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toContain('Invalid token');
		});

		it('should handle public_write permission', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${publicDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Public Write Update' })
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					name: string;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data.name).toBe('Public Write Update');
		});

		it('should handle user_write permission', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${userSpecificDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'User Write Update' })
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					name: string;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data.name).toBe('User Write Update');
		});

		it('should handle role_write permission', async () => {
			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${roleSpecificDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Role Write Update' })
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					name: string;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data.name).toBe('Role Write Update');
		});
	});
});