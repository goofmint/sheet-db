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
	});

	afterEach(async () => {
		await cleanupSheets(testContext.sessionId, testContext.createdSheetIds);
		testContext.createdSheetIds = [];
	});

	describe('Successful sheet creation', () => {
		it('should create a new sheet with valid data and permissions', async () => {
			const createData: SheetCreateRequest = {
				name: `TestSheet_${Date.now()}`,
				public_read: true,
				public_write: false,
				role_read: [],
				role_write: ['admin'],
				user_read: [],
				user_write: [testContext.userInfo.sub]
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.sheetId).toBeTypeOf('number');
			expect(data.data!.public_read).toBe(true);
			expect(data.data!.public_write).toBe(false);
			expect(data.data!.role_read).toEqual([]);
			expect(data.data!.role_write).toEqual(['admin']);
			expect(data.data!.user_read).toEqual([]);
			expect(data.data!.user_write).toEqual([testContext.userInfo.sub]);
			expect(data.data!.message).toContain('created successfully');
			
			// Track created sheet for cleanup
			testContext.createdSheetIds.push(data.data!.sheetId);
		});

		it('should use default permissions when not provided', async () => {
			const createData = createTestSheetRequest({
				name: `TestSheet_Defaults_${Date.now()}`
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.public_read).toBe(true); // Default value
			expect(data.data!.public_write).toBe(false); // Default value
			expect(data.data!.user_write).toContain(testContext.userInfo.sub); // Default to creator
			
			// Track created sheet for cleanup
			testContext.createdSheetIds.push(data.data!.sheetId);
		});

		it('should create sheet with custom permissions', async () => {
			const createData: SheetCreateRequest = {
				name: `TestSheet_Custom_${Date.now()}`,
				public_read: false,
				public_write: true,
				role_read: ['viewer'],
				role_write: ['editor', 'admin'],
				user_read: ['user456'],
				user_write: ['user789']
			};

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(200);
			const data = await response.json() as SheetCreateResponse;

			expect(data.success).toBe(true);
			expect(data.data).toBeDefined();
			expect(data.data!.name).toBe(createData.name);
			expect(data.data!.public_read).toBe(false);
			expect(data.data!.public_write).toBe(true);
			expect(data.data!.role_read).toEqual(['viewer']);
			expect(data.data!.role_write).toEqual(['editor', 'admin']);
			expect(data.data!.user_read).toEqual(['user456']);
			expect(data.data!.user_write).toEqual(['user789']);
			
			// Track created sheet for cleanup
			testContext.createdSheetIds.push(data.data!.sheetId);
		});
	});
});