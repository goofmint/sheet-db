import { describe, it, expect } from 'vitest';
import { 
	setupSheetDataTests, 
	testSessionId, 
	testSheetId, 
	createdDataIds,
	BASE_URL
} from './helpers';

describe('Sheet Data POST API - Operations', () => {
	setupSheetDataTests();

	describe('POST /api/sheets/:id/data - Data Operations', () => {
		it('should create data successfully with valid fields', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Test User', 
					email: 'test@example.com',
					score: 100
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json() as {
					success: boolean;
					data: {
						id: string;
						created_at: string;
						updated_at: string;
						name: string;
						email: string;
						score: number;
					};
				};
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.id).toBeDefined();
				expect(data.data.created_at).toBeDefined();
				expect(data.data.updated_at).toBeDefined();
				expect(data.data.name).toBe('Test User');
				expect(data.data.email).toBe('test@example.com');
				expect(data.data.score).toBe(100);
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			} else {
				throw new Error(`Expected 200 status for valid data creation, got ${resp.status}`);
			}
		});

		it('should handle empty request body', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({})
			});
			
			if (resp.status === 200) {
				const data = await resp.json() as {
					success: boolean;
					data: {
						id: string;
						created_at: string;
						updated_at: string;
					};
				};
				expect(data.success).toBe(true);
				expect(data.data).toBeDefined();
				expect(data.data.id).toBeDefined();
				expect(data.data.created_at).toBeDefined();
				expect(data.data.updated_at).toBeDefined();
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			} else {
				throw new Error(`Expected 200 status for empty request body, got ${resp.status}`);
			}
		});

		it('should handle complex data types', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			const resp = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({ 
					name: 'Complex Data Test',
					metadata: { key: 'value', nested: { data: true } },
					tags: ['tag1', 'tag2', 'tag3'],
					is_active: true
				})
			});
			
			if (resp.status === 200) {
				const data = await resp.json() as {
					success: boolean;
					data: {
						id: string;
						metadata: any;
						tags: string[];
						is_active: boolean;
					};
				};
				expect(data.success).toBe(true);
				expect(data.data.metadata).toBeDefined();
				expect(data.data.tags).toBeDefined();
				expect(data.data.is_active).toBe(true);
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			} else {
				throw new Error(`Expected 200 status for complex data types, got ${resp.status}`);
			}
		});

		it('should generate unique IDs for concurrent requests', async () => {
			if (!testSessionId) {
				throw new Error('Test session not available');
			}

			// Test concurrent requests to ensure unique ID generation
			const requests = Array.from({ length: 5 }, () => 
				fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${testSessionId}`
					},
					body: JSON.stringify({ name: 'Concurrent Test' })
				})
			);
			
			const responses = await Promise.all(requests);
			const ids = new Set();
			
			for (const resp of responses) {
				expect(resp.status).toBe(200);
				const data = await resp.json() as {
					success: boolean;
					data: { id: string };
				};
				expect(data.success).toBe(true);
				expect(data.data.id).toBeDefined();
				ids.add(data.data.id);
				createdDataIds.push({ sheetId: testSheetId, dataId: data.data.id });
			}
			
			// All IDs should be unique
			if (ids.size > 1) {
				expect(ids.size).toBe(responses.filter(r => r.status === 200).length);
			}
		});

		it('should handle public_write=true sheets without authentication', async () => {
			requireSession(testSessionId);

			const resp = await fetch(`${BASE_URL}/api/sheets/public-write-sheet/data`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({ name: 'Public Write Test' })
			});
			
			expect(resp.status).toBe(200);
			const data = await resp.json() as {
				success: boolean;
				data: {
					id: string;
					name: string;
				};
			};
			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data.id).toBeDefined();
			expect(data.data.name).toBe('Public Write Test');
			createdDataIds.push({ sheetId: 'public-write-sheet', dataId: data.data.id });
		});
	});
});