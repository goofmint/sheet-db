import { describe, it, expect, beforeAll } from 'vitest';
import { 
	setupSheetAuth, 
	createSheetHeaders,
	BASE_URL,
	type SheetTestContext 
} from './helpers';

describe('Sheet API - Creation Validation Tests', () => {
	let testContext: SheetTestContext;

	beforeAll(async () => {
		const auth = await setupSheetAuth();
		testContext = {
			...auth,
			createdSheetIds: []
		};
	}, 30000);

	describe('Input validation', () => {
		it('should reject sheet creation without name', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify({
					public_read: true,
					public_write: false
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.success).toBe(false);
			expect(data.error).toContain('name');
		});

		it('should reject sheet creation with empty name', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify({
					name: '',
					public_read: true,
					public_write: false
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.success).toBe(false);
		});

		it('should reject sheet creation with invalid JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: 'invalid json'
			});

			expect(response.status).toBe(400);
		});

		it('should reject unauthenticated requests', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: 'Test Sheet',
					public_read: true,
					public_write: false
				})
			});

			expect(response.status).toBe(400);
		});
	});
});