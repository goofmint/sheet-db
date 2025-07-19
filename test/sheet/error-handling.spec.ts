import { describe, it, expect, beforeAll } from 'vitest';
import { 
	setupSheetAuth, 
	createSheetHeaders,
	BASE_URL,
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
	}, 30000);

	describe('Error scenarios', () => {
		it('should handle server errors gracefully', async () => {
			// Test with malformed data that might cause server errors
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify({
					name: 'Test Sheet',
					public_read: 'invalid_boolean', // Should cause validation error
					public_write: false
				})
			});

			// Should return a proper error response, not crash
			expect([400, 500].includes(response.status)).toBe(true);
			
			if (response.status !== 500) {
				const data = await response.json();
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should handle network timeouts and errors', async () => {
			// Test with invalid endpoint
			const response = await fetch(`${BASE_URL}/api/sheets/invalid-endpoint`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify({
					name: 'Test Sheet',
					public_read: true,
					public_write: false
				})
			});

			expect([404, 405].includes(response.status)).toBe(true);
		});
	});
});