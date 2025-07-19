import { BASE_URL } from '../helpers/auth';
import { getGlobalAuth } from '../setup/global-auth';

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
	// Use global authentication (shared across all test files)
	const auth = await getGlobalAuth();
	
	return {
		sessionId: auth.sessionId,
		userInfo: auth.userInfo
	};
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