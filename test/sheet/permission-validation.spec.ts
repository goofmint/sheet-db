import { describe, it, expect, beforeAll } from 'vitest';
import { 
	setupSheetAuth, 
	createSheetHeaders,
	BASE_URL,
	type SheetCreateResponse,
	type SheetTestContext 
} from './helpers';

describe('Sheet API - Permission Validation Tests', () => {
	let testContext: Omit<SheetTestContext, 'createdSheetIds'>;

	beforeAll(async () => {
		testContext = await setupSheetAuth();
	});

	describe('Permission field validation', () => {
		it('should validate array types for permission fields', async () => {
			const createData = {
				name: `TestSheet_InvalidPerms_${Date.now()}`,
				role_read: 'not-an-array', // Should be array
				role_write: ['admin'],
				user_read: [],
				user_write: []
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate boolean types for public permission fields', async () => {
			const createData = {
				name: `TestSheet_InvalidBool_${Date.now()}`,
				public_read: 'not-a-boolean', // Should be boolean
				public_write: false,
				role_read: [],
				role_write: []
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(400);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});