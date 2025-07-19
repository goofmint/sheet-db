// Global authentication setup for all tests
// Uses shared auth cache to minimize Auth0 API calls

import { getSharedAuth } from './shared-auth';

// Get global authentication using shared cache
export async function getGlobalAuth(): Promise<{
	sessionId: string;
	userInfo: { sub: string; email: string };
	accessToken: string;
}> {
	return await getSharedAuth();
}