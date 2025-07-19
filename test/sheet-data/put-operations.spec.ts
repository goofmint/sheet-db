import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	existingDataId,
	BASE_URL,
	createJsonHeaders,
	requireSession
} from './helpers';

describe('Sheet Data PUT API - Operations', () => {
	setupSheetDataTests();

	describe('PUT /api/sheets/:id/data/:dataId - Update Operations', () => {
		it('should update data successfully with valid fields', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Updated Test User', 
					email: 'updated@example.com',
					score: 150
				})
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					id: string;
					updated_at: string;
					name: string;
					email: string;
					score: number;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data.id).toBeDefined();
			expect(data.data.updated_at).toBeDefined();
			expect(data.data.name).toBe('Updated Test User');
			expect(data.data.email).toBe('updated@example.com');
			expect(data.data.score).toBe(150);
		});

		it('should handle partial updates', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Partially Updated User'
				})
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					name: string;
					updated_at: string;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data.name).toBe('Partially Updated User');
			expect(data.data.updated_at).toBeDefined();
		});

		it('should update complex data types', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data/${existingDataId}`, {
				method: 'PUT',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ 
					name: 'Complex Data Update',
					metadata: { key: 'updated_value', nested: { data: false } },
					tags: ['updated_tag1', 'updated_tag2'],
					is_active: false
				})
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					name: string;
					metadata: any;
					tags: string[];
					is_active: boolean;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data.name).toBe('Complex Data Update');
			expect(data.data.metadata).toEqual({ key: 'updated_value', nested: { data: false } });
			expect(data.data.tags).toEqual(['updated_tag1', 'updated_tag2']);
			expect(data.data.is_active).toBe(false);
		});
	});
});