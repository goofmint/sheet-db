import { beforeAll, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { BASE_URL } from '../helpers/auth';
import { getGlobalAuth } from '../setup/global-auth';
import type { ApiErrorResponse, AuthCallbackResponse, BaseSuccessResponseWithData } from '../types/api-responses';

// Define interfaces for API responses used in this file
interface DataCreationResponse {
	success: boolean;
	data?: {
		id: string;
		[key: string]: any;
	};
}

interface SheetCreationResponse {
	success: boolean;
	data?: {
		id: string;
		name: string;
		[key: string]: any;
	};
}

// Shared test state
export let testSessionId: string | null = null;
export let testUserInfo: { sub: string; email: string } | null = null;
export let createdDataIds: { sheetId: string; dataId: string }[] = [];

// Dynamically created test IDs
export let testSheetId: string;
export let existingDataId: string;
export let testDataId: string;
export let publicDataId: string;
export let userSpecificDataId: string;
export let roleSpecificDataId: string;

// Function to setup test data
export async function setupTestData() {
	// Generate unique test sheet ID based on timestamp
	const timestamp = Date.now();
	testSheetId = `test-sheet-${timestamp}`;
	
	// Create test sheet first
	const createSheetResponse = await fetch(`${BASE_URL}/api/sheets`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(testSessionId ? { 'Authorization': `Bearer ${testSessionId}` } : {})
		},
		body: JSON.stringify({
			name: testSheetId,
			public_read: true,
			public_write: true
		})
	});
	
	if (!createSheetResponse.ok) {
		const errorText = await createSheetResponse.text();
		throw new Error(`Failed to create test sheet: ${createSheetResponse.status} ${errorText}`);
	}
	
	// Create test data entries using simpler structure
	// Many sheet-data tests just need some data IDs to work with
	// We'll create minimal data to satisfy the tests
	const testDataEntries = [
		{ type: 'existing' },
		{ type: 'test' },
		{ type: 'public' },
		{ type: 'user' },
		{ type: 'role' }
	];
	
	for (const entry of testDataEntries) {
		// Try creating data with minimal required fields
		const createDataResponse = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(testSessionId ? { 'Authorization': `Bearer ${testSessionId}` } : {})
			},
			body: JSON.stringify({
				// Use basic structure that should work with most sheets
				test_data: `${entry.type}-entry-${Date.now()}`
			})
		});
		
		if (!createDataResponse.ok) {
			const errorText = await createDataResponse.text();
			
			// If specific column doesn't exist, try with even simpler structure
			if (errorText.includes('does not exist')) {
				const simpleCreateResponse = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(testSessionId ? { 'Authorization': `Bearer ${testSessionId}` } : {})
					},
					body: JSON.stringify({
						// Just send timestamp as data
						timestamp: Date.now().toString()
					})
				});
				
				if (!simpleCreateResponse.ok) {
					const simpleErrorText = await simpleCreateResponse.text();
					throw new Error(`Failed to create test data (${entry.type}) even with simple structure: ${simpleCreateResponse.status} ${simpleErrorText}`);
				}
				
				const simpleData = await simpleCreateResponse.json() as DataCreationResponse;
				if (!simpleData.data?.id) {
					throw new Error(`Test data creation response missing ID for ${entry.type}: ${JSON.stringify(simpleData)}`);
				}
				
				const dataId = simpleData.data.id;
				createdDataIds.push({ sheetId: testSheetId, dataId });
				
				// Assign to appropriate variables
				switch (entry.type) {
					case 'existing':
						existingDataId = dataId;
						break;
					case 'test':
						testDataId = dataId;
						break;
					case 'public':
						publicDataId = dataId;
						break;
					case 'user':
						userSpecificDataId = dataId;
						break;
					case 'role':
						roleSpecificDataId = dataId;
						break;
				}
			} else {
				throw new Error(`Failed to create test data (${entry.type}): ${createDataResponse.status} ${errorText}`);
			}
		} else {
			const data = await createDataResponse.json() as DataCreationResponse;
			if (!data.data?.id) {
				throw new Error(`Test data creation response missing ID for ${entry.type}: ${JSON.stringify(data)}`);
			}
			
			const dataId = data.data.id;
			createdDataIds.push({ sheetId: testSheetId, dataId });
			
			// Assign to appropriate variables
			switch (entry.type) {
				case 'existing':
					existingDataId = dataId;
					break;
				case 'test':
					testDataId = dataId;
					break;
				case 'public':
					publicDataId = dataId;
					break;
				case 'user':
					userSpecificDataId = dataId;
					break;
				case 'role':
					roleSpecificDataId = dataId;
					break;
			}
		}
	}
	
	// Verify all data IDs were created
	if (!existingDataId || !testDataId || !publicDataId || !userSpecificDataId || !roleSpecificDataId) {
		throw new Error('Failed to create all required test data');
	}
}

// Setup function for all sheet data tests
export function setupSheetDataTests() {
	beforeAll(async () => {
		console.log('Setting up authentication for sheet data tests...');
		
		// Use global authentication (shared across all test files)
		const auth = await getGlobalAuth();
		testSessionId = auth.sessionId;
		testUserInfo = auth.userInfo;
		
		console.log('Successfully obtained shared authentication for sheet data tests');
		
		// Setup test data
		await setupTestData();
	}, 30000); // 30 second timeout for potential Auth0 initialization
	
	afterEach(async () => {
		// Clean up any data created during tests
		for (const { sheetId, dataId } of createdDataIds) {
			try {
				await fetch(`${BASE_URL}/api/sheets/${sheetId}/data/${dataId}`, {
					method: 'DELETE',
					headers: {
						...(testSessionId ? { 'Authorization': `Bearer ${testSessionId}` } : {})
					}
				});
			} catch (error) {
				// Ignore cleanup errors
			}
		}
		
		// Reset the created data IDs for next test
		createdDataIds = [];
	});
}

// Import shared helper functions
export { createAuthHeaders, createJsonHeaders, requireSession } from '../helpers/common';

// Export types for convenience
export type { ApiErrorResponse, AuthCallbackResponse };
export { BASE_URL };