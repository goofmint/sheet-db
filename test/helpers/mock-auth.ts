// Mock authentication helper for tests that don't require real Auth0 integration

export interface MockAuthConfig {
	sessionId: string;
	userId: string;
	userInfo: {
		sub: string;
		email: string;
		name?: string;
		given_name?: string;
		family_name?: string;
		nickname?: string;
		picture?: string;
		email_verified?: boolean;
		locale?: string;
		roles?: string[];
	};
}

// Default mock user for tests
export const DEFAULT_MOCK_USER: MockAuthConfig = {
	sessionId: 'mock-session-12345',
	userId: 'mock-user-12345',
	userInfo: {
		sub: 'auth0|mock-user-12345',
		email: 'test@example.com',
		name: 'Test User',
		given_name: 'Test',
		family_name: 'User',
		nickname: 'testuser',
		picture: 'https://example.com/avatar.jpg',
		email_verified: true,
		locale: 'en',
		roles: ['admin']
	}
};

// Create mock authentication headers
export const createMockAuthHeaders = (sessionId?: string, contentType = false) => {
	const headers: Record<string, string> = {
		'Authorization': `Bearer ${sessionId || DEFAULT_MOCK_USER.sessionId}`
	};
	
	if (contentType) {
		headers['Content-Type'] = 'application/json';
	}
	
	return headers;
};

// Create test user with custom properties
export const createMockUser = (overrides: Partial<MockAuthConfig> = {}): MockAuthConfig => {
	return {
		...DEFAULT_MOCK_USER,
		...overrides,
		userInfo: {
			...DEFAULT_MOCK_USER.userInfo,
			...overrides.userInfo
		}
	};
};

// Simulate successful authentication
export const mockAuthSuccess = () => {
	return Promise.resolve(DEFAULT_MOCK_USER);
};

// Simulate authentication failure
export const mockAuthFailure = (reason = 'Authentication failed') => {
	return Promise.reject(new Error(reason));
};