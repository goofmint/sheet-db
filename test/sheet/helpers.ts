import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';

export { BASE_URL };

// Types for testing
export interface SheetCreateRequest {
	name: string;
	public_read?: boolean;
	public_write?: boolean;
	role_read?: string[];
	role_write?: string[];
	user_read?: string[];
	user_write?: string[];
}

export interface SheetCreateResponse {
	success: boolean;
	data?: {
		name: string;
		sheetId: number;
		public_read: boolean;
		public_write: boolean;
		role_read: string[];
		role_write: string[];
		user_read: string[];
		user_write: string[];
		message: string;
	};
	error?: string;
}

export interface SheetTestContext {
	sessionId: string;
	userInfo: { sub: string; email: string };
	createdSheetIds: number[];
}

// Setup authentication for sheet tests
export const setupSheetAuth = async (): Promise<Omit<SheetTestContext, 'createdSheetIds'>> => {
	try {
		// Get Auth0 configuration from cloudflare:test environment
		const config = validateAuth0Config();
		if (!config) {
			console.log('Auth0 configuration not complete, using fallback authentication');
			return {
				sessionId: 'test-session-fallback',
				userInfo: { sub: 'test-user', email: 'test@example.com' }
			};
		}

		// Get a real Auth0 token for authentication
		const accessToken = await fetchAuth0Token(config);
		if (!accessToken) {
			console.log('Could not obtain Auth0 access token, using fallback authentication');
			return {
				sessionId: 'test-session-fallback',
				userInfo: { sub: 'test-user', email: 'test@example.com' }
			};
		}

		// Get user info from Auth0
		const userInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
		if (!userInfo) {
			console.log('Could not obtain Auth0 user info, using fallback authentication');
			return {
				sessionId: 'test-session-fallback',
				userInfo: { sub: 'test-user', email: 'test@example.com' }
			};
		}

		// Login to get session ID
		const loginResponse = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				token: accessToken,
				userInfo: {
					...userInfo,
					name: 'Sheet Test User',
					given_name: 'Sheet',
					family_name: 'Test',
					nickname: 'sheettest',
					picture: 'https://example.com/avatar.jpg',
					email_verified: true,
					locale: 'en'
				}
			})
		});

		const loginData = await loginResponse.json() as { success: boolean; data: { sessionId: string } };
		if (!loginResponse.ok || !loginData.success) {
			console.log('Failed to login, using fallback authentication');
			return {
				sessionId: 'test-session-fallback',
				userInfo
			};
		}

		return {
			sessionId: loginData.data.sessionId,
			userInfo
		};
	} catch (error) {
		console.log('Authentication setup failed, using fallback authentication:', error);
		return {
			sessionId: 'test-session-fallback',
			userInfo: { sub: 'test-user', email: 'test@example.com' }
		};
	}
};

// Clean up created sheets
export const cleanupSheets = async (sessionId: string, sheetIds: number[]): Promise<void> => {
	if (sheetIds.length === 0) return;

	console.log(`Cleaning up ${sheetIds.length} created sheets...`);
	
	for (const sheetId of sheetIds) {
		try {
			const deleteResponse = await fetch(`${BASE_URL}/api/sheets/${sheetId}`, {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${sessionId}`
				}
			});
			
			if (deleteResponse.ok) {
				console.log(`Successfully deleted sheet ${sheetId}`);
			} else {
				console.warn(`Failed to delete sheet ${sheetId}: ${deleteResponse.status}`);
			}
		} catch (error) {
			console.warn(`Error deleting sheet ${sheetId}:`, error);
		}
	}
};

// Create request headers with authentication
export const createSheetHeaders = (sessionId: string, contentType = true) => {
	const headers: Record<string, string> = {
		'Authorization': `Bearer ${sessionId}`
	};
	
	if (contentType) {
		headers['Content-Type'] = 'application/json';
	}
	
	return headers;
};

// Create a test sheet request with defaults
export const createTestSheetRequest = (overrides: Partial<SheetCreateRequest> = {}): SheetCreateRequest => {
	return {
		name: `TestSheet_${Date.now()}`,
		public_read: true,
		public_write: false,
		role_read: [],
		role_write: [],
		user_read: [],
		user_write: [],
		...overrides
	};
};

// Fetch and validate sheet creation response
export const createSheet = async (sessionId: string, data: SheetCreateRequest): Promise<SheetCreateResponse> => {
	const response = await fetch(`${BASE_URL}/api/sheets`, {
		method: 'POST',
		headers: createSheetHeaders(sessionId),
		body: JSON.stringify(data)
	});

	return await response.json() as SheetCreateResponse;
};