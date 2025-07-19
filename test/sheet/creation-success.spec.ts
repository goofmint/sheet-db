import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { 
	setupSheetAuth, 
	cleanupSheets, 
	createTestSheetRequest, 
	createSheetHeaders,
	BASE_URL,
	type SheetCreateRequest,
	type SheetCreateResponse,
	type SheetTestContext 
} from './helpers';

describe('Sheet API - Creation Success Tests', () => {
	let testContext: SheetTestContext;

	beforeAll(async () => {
		const auth = await setupSheetAuth();
		testContext = {
			...auth,
			createdSheetIds: []
		};
	}, 30000);

	afterEach(async () => {
		if (testContext.createdSheetIds.length > 0) {
			await cleanupSheets(testContext.sessionId, testContext.createdSheetIds);
			testContext.createdSheetIds = [];
		}
	});

	describe('Successful sheet creation', () => {
		it('should create a basic sheet with valid data', async () => {
			const sheetData = createTestSheetRequest({
				name: `BasicSheet_${Date.now()}`,
				public_read: true,
				public_write: false
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(sheetData)
			});

			const data = await response.json() as SheetCreateResponse;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data?.name).toBe(sheetData.name);
			expect(data.data?.public_read).toBe(true);
			expect(data.data?.public_write).toBe(false);

			if (data.data?.sheetId) {
				testContext.createdSheetIds.push(data.data.sheetId);
			}
		});

		it('should create a sheet with role permissions', async () => {
			const sheetData = createTestSheetRequest({
				name: `RoleSheet_${Date.now()}`,
				public_read: false,
				public_write: false,
				role_read: ['admin', 'editor'],
				role_write: ['admin']
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(sheetData)
			});

			const data = await response.json() as SheetCreateResponse;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data?.role_read).toEqual(['admin', 'editor']);
			expect(data.data?.role_write).toEqual(['admin']);

			if (data.data?.sheetId) {
				testContext.createdSheetIds.push(data.data.sheetId);
			}
		});

		it('should create a sheet with user permissions', async () => {
			const sheetData = createTestSheetRequest({
				name: `UserSheet_${Date.now()}`,
				public_read: false,
				public_write: false,
				user_read: [testContext.userInfo.sub],
				user_write: [testContext.userInfo.sub]
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(sheetData)
			});

			const data = await response.json() as SheetCreateResponse;

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.data?.user_read).toEqual([testContext.userInfo.sub]);
			expect(data.data?.user_write).toEqual([testContext.userInfo.sub]);

			if (data.data?.sheetId) {
				testContext.createdSheetIds.push(data.data.sheetId);
			}
		});
	});
});