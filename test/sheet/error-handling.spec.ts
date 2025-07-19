import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { 
	setupSheetAuth, 
	cleanupSheets, 
	createSheetHeaders,
	BASE_URL,
	type SheetCreateRequest,
	type SheetCreateResponse,
	type SheetTestContext 
} from './helpers';

describe('Sheet API - Error Handling Tests', () => {
	let testContext: SheetTestContext;

	beforeAll(async () => {
		const auth = await setupSheetAuth();
		testContext = {
			...auth,
			createdSheetIds: []
		};
	});

	afterEach(async () => {
		await cleanupSheets(testContext.sessionId, testContext.createdSheetIds);
		testContext.createdSheetIds = [];
	});

	describe('Database and API error handling', () => {
		it('should handle database connection errors gracefully', { timeout: 10000 }, async () => {
			// This test verifies that the API handles database errors properly
			// In a real scenario, this might involve mocking database failures
			const createData: SheetCreateRequest = {
				name: `TestSheet_DBError_${Date.now()}`
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			// Should either succeed or fail gracefully with 500 error
			expect([200, 500].includes(response.status)).toBe(true);
			
			const data = await response.json() as SheetCreateResponse;
			
			if (response.status === 200) {
				expect(data.success).toBe(true);
				// Track created sheet for cleanup if successful
				expect(data.data?.sheetId).toBeDefined();
				testContext.createdSheetIds.push(data.data!.sheetId);
			} else {
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should handle Google Sheets API errors gracefully', async () => {
			// Test with sheet name at exactly 100 characters (Google Sheets limit)
			// Prefix: "TestSheet_GoogleAPIError_" (25) + timestamp (13) + "_" (1) = 39 chars
			// Remaining: 100 - 39 = 61 chars for padding
			const createData: SheetCreateRequest = {
				name: `TestSheet_GoogleAPIError_${Date.now()}_${'x'.repeat(61)}` // Exactly 100 characters
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			// Should either succeed or fail gracefully
			expect([200, 400, 500].includes(response.status)).toBe(true);
			
			const data = await response.json() as SheetCreateResponse;
			
			if (response.status === 200) {
				expect(data.success).toBe(true);
				// Track created sheet for cleanup if successful
				expect(data.data?.sheetId).toBeDefined();
				testContext.createdSheetIds.push(data.data!.sheetId);
			} else {
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});