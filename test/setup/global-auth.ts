// Global authentication setup for all tests
// This ensures Auth0 authentication happens only once across all test files

import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';
import type { AuthCallbackResponse } from '../types/api-responses';

// Global authentication state - shared across all tests
let globalAuth: {
	sessionId: string;
	userInfo: { sub: string; email: string };
	accessToken: string;
	isInitialized: boolean;
} | null = null;

// Track initialization promise to avoid concurrent setup
let initializationPromise: Promise<void> | null = null;

// Delay function to avoid rate limiting
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize authentication once for all tests
async function initializeGlobalAuth(): Promise<void> {
	if (globalAuth?.isInitialized) {
		return; // Already initialized
	}

	console.log('🔐 Initializing global Auth0 authentication...');

	// Get Auth0 configuration (will throw if incomplete)
	const config = validateAuth0Config();

	// Get Auth0 access token (with retry logic)
	const accessToken = await fetchAuth0Token(config);
	if (!accessToken) {
		throw new Error('Failed to obtain Auth0 access token');
	}

	// Add longer delay after token request for rate limiting
	await delay(1000);

	// Get user info from Auth0 (with retry logic)
	const userInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
	if (!userInfo) {
		throw new Error('Failed to get user info from Auth0');
	}

	// Add longer delay after user info request for rate limiting
	await delay(1000);

	// Login to get session ID
	const loginResponse = await fetch(`${BASE_URL}/api/login`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			token: accessToken,
			userInfo: userInfo
		})
	});

	if (!loginResponse.ok) {
		const errorText = await loginResponse.text();
		throw new Error(`Login request failed: ${loginResponse.status} ${errorText}`);
	}

	const loginData = await loginResponse.json() as AuthCallbackResponse;
	if (!loginData.data?.sessionId) {
		throw new Error(`Login response missing sessionId: ${JSON.stringify(loginData)}`);
	}

	// Store global authentication state
	globalAuth = {
		sessionId: loginData.data.sessionId,
		userInfo,
		accessToken,
		isInitialized: true
	};

	console.log('✅ Global Auth0 authentication completed successfully');
	
	// Add longer delay after successful setup to reduce pressure on Auth0
	await delay(2000);
}

// Get global authentication (initialize if needed)
export async function getGlobalAuth(): Promise<{
	sessionId: string;
	userInfo: { sub: string; email: string };
	accessToken: string;
}> {
	// If initialization is already in progress, wait for it
	if (initializationPromise) {
		await initializationPromise;
		if (!globalAuth?.isInitialized) {
			throw new Error('Authentication initialization failed');
		}
		return globalAuth;
	}

	// If not initialized, start initialization
	if (!globalAuth?.isInitialized) {
		initializationPromise = initializeGlobalAuth();
		await initializationPromise;
		initializationPromise = null; // Reset for future use
	}

	if (!globalAuth?.isInitialized) {
		throw new Error('Failed to initialize global authentication');
	}

	return globalAuth;
}

// Reset global auth (for test cleanup if needed)
export function resetGlobalAuth(): void {
	globalAuth = null;
	initializationPromise = null;
}

// Check if authentication is already available
export function isAuthInitialized(): boolean {
	return globalAuth?.isInitialized === true;
}

// Get current auth state without initializing (returns null if not ready)
export function getCurrentAuth(): typeof globalAuth {
	return globalAuth?.isInitialized ? globalAuth : null;
}