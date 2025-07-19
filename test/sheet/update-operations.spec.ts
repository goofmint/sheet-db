import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { 
	setupSheetAuth, 
	cleanupSheets,
	createTestSheetRequest,
	createSheetHeaders,
	createSheet,
	BASE_URL,
	type SheetTestContext 
} from './helpers';

describe('Sheet Update API - Operations', () => {
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

	describe('Basic update operations', () => {
		it('should update sheet properties successfully', async () => {
			// First create a test sheet
			const createData = createTestSheetRequest({
				name: `UpdateTest_${Date.now()}`,
				public_read: true,
				public_write: false
			});

			const createResponse = await createSheet(testContext.sessionId, createData);
			expect(createResponse.success).toBe(true);
			
			if (createResponse.data?.sheetId) {
				testContext.createdSheetIds.push(createResponse.data.sheetId);

				// Now update the sheet
				const updateResponse = await fetch(`${BASE_URL}/api/sheets/${createResponse.data.sheetId}`, {
					method: 'PUT',
					headers: createSheetHeaders(testContext.sessionId),
					body: JSON.stringify({
						public_read: false,
						public_write: true
					})
				});

				expect(updateResponse.status).toBe(200);
				const updateData = await updateResponse.json();
				expect(updateData.success).toBe(true);
				expect(updateData.data?.public_read).toBe(false);
				expect(updateData.data?.public_write).toBe(true);
			}
		});

		it('should update role permissions', async () => {
			const createData = createTestSheetRequest({
				name: `RoleUpdateTest_${Date.now()}`,
				role_read: ['admin'],
				role_write: []
			});

			const createResponse = await createSheet(testContext.sessionId, createData);
			expect(createResponse.success).toBe(true);
			
			if (createResponse.data?.sheetId) {
				testContext.createdSheetIds.push(createResponse.data.sheetId);

				const updateResponse = await fetch(`${BASE_URL}/api/sheets/${createResponse.data.sheetId}`, {
					method: 'PUT',
					headers: createSheetHeaders(testContext.sessionId),
					body: JSON.stringify({
						role_read: ['admin', 'editor'],
						role_write: ['admin']
					})
				});

				expect(updateResponse.status).toBe(200);
				const updateData = await updateResponse.json();
				expect(updateData.success).toBe(true);
				expect(updateData.data?.role_read).toEqual(['admin', 'editor']);
				expect(updateData.data?.role_write).toEqual(['admin']);
			}
		});

		it('should update user permissions', async () => {
			const createData = createTestSheetRequest({
				name: `UserUpdateTest_${Date.now()}`,
				user_read: [],
				user_write: []
			});

			const createResponse = await createSheet(testContext.sessionId, createData);
			expect(createResponse.success).toBe(true);
			
			if (createResponse.data?.sheetId) {
				testContext.createdSheetIds.push(createResponse.data.sheetId);

				const updateResponse = await fetch(`${BASE_URL}/api/sheets/${createResponse.data.sheetId}`, {
					method: 'PUT',
					headers: createSheetHeaders(testContext.sessionId),
					body: JSON.stringify({
						user_read: [testContext.userInfo.sub],
						user_write: [testContext.userInfo.sub]
					})
				});

				expect(updateResponse.status).toBe(200);
				const updateData = await updateResponse.json();
				expect(updateData.success).toBe(true);
				expect(updateData.data?.user_read).toEqual([testContext.userInfo.sub]);
				expect(updateData.data?.user_write).toEqual([testContext.userInfo.sub]);
			}
		});
	});
});