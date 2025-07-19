import { beforeAll, afterEach } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';
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
		console.log('Failed to create test sheet, using fallback ID');
		testSheetId = 'test-sheet';
	}
	
	// Create test data entries
	const testDataEntries = [
		{ id: 'existing-data', type: 'existing' },
		{ id: 'test-data', type: 'test' },
		{ id: 'public-data', type: 'public' },
		{ id: 'user-specific-data', type: 'user' },
		{ id: 'role-specific-data', type: 'role' }
	];
	
	for (const entry of testDataEntries) {
		const createDataResponse = await fetch(`${BASE_URL}/api/sheets/${testSheetId}/data`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(testSessionId ? { 'Authorization': `Bearer ${testSessionId}` } : {})
			},
			body: JSON.stringify({
				name: `${entry.type}-entry`,
				description: `Test ${entry.type} data entry`,
				value: Math.floor(Math.random() * 100)
			})
		});
		
		if (createDataResponse.ok) {
			const data = await createDataResponse.json() as DataCreationResponse;
			const dataId = data.data?.id || `${entry.id}-${timestamp}`;
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
	
	// Set fallback IDs if creation failed
	if (!existingDataId) existingDataId = 'existing-id';
	if (!testDataId) testDataId = 'test-id';
	if (!publicDataId) publicDataId = 'public-data-id';
	if (!userSpecificDataId) userSpecificDataId = 'user-specific-data-id';
	if (!roleSpecificDataId) roleSpecificDataId = 'role-specific-data-id';
}

// Setup function for all sheet data tests
export function setupSheetDataTests() {
	beforeAll(async () => {
		// Try to get Auth0 configuration but don't fail if it's not available
		try {
			const config = validateAuth0Config();
			if (config) {
				console.log('Setting up authentication for sheet data tests...');
				
				// Get a real Auth0 token for authentication
				const accessToken = await fetchAuth0Token(config);
				if (accessToken) {
					// Get user info from Auth0
					testUserInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
					
					if (testUserInfo) {
						// Login to get session ID
						const loginResponse = await fetch(`${BASE_URL}/api/login`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({
								token: accessToken,
								userInfo: testUserInfo
							})
						});
						
						if (loginResponse.ok) {
							const loginData = await loginResponse.json() as AuthCallbackResponse;
							testSessionId = loginData.data.sessionId;
							console.log('Successfully authenticated for sheet data tests');
						}
					}
				}
			}
		} catch (error) {
			console.log('Auth0 setup failed, using fallback test session');
		}
		
		// If no session was obtained, use a fallback test session for basic testing
		if (!testSessionId) {
			testSessionId = 'test-session-fallback';
			console.log('Using fallback test session for basic functionality testing');
		}
		
		// Setup test data
		await setupTestData();
	});
	
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