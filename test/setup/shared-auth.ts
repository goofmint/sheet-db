// Shared authentication across all test files
// Reduces Auth0 API calls by caching authentication results

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';
import type { AuthCallbackResponse } from '../types/api-responses';

const AUTH_CACHE_FILE = '/tmp/sheet-db-test-auth.json';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

interface CachedAuth {
	sessionId: string;
	userInfo: { sub: string; email: string };
	accessToken: string;
	timestamp: number;
}

// Check if cached auth is still valid
function isCacheValid(cachedAuth: CachedAuth): boolean {
	const now = Date.now();
	return (now - cachedAuth.timestamp) < CACHE_DURATION;
}

// Get cached authentication if valid
function getCachedAuth(): CachedAuth | null {
	try {
		if (!existsSync(AUTH_CACHE_FILE)) {
			return null;
		}
		
		const cached = JSON.parse(readFileSync(AUTH_CACHE_FILE, 'utf8')) as CachedAuth;
		
		if (isCacheValid(cached)) {
			console.log('📋 Using cached Auth0 authentication');
			return cached;
		} else {
			console.log('⏰ Cached Auth0 authentication expired');
			return null;
		}
	} catch (error) {
		console.log('❌ Failed to read cached auth:', error);
		return null;
	}
}

// Save authentication to cache
function cacheAuth(auth: CachedAuth): void {
	try {
		writeFileSync(AUTH_CACHE_FILE, JSON.stringify(auth, null, 2));
		console.log('💾 Cached Auth0 authentication for future tests');
	} catch (error) {
		console.log('⚠️ Failed to cache auth:', error);
	}
}

// Perform fresh Auth0 authentication
async function performFreshAuth(): Promise<CachedAuth> {
	console.log('🔐 Performing fresh Auth0 authentication...');

	// Get Auth0 configuration
	const config = validateAuth0Config();

	// Get Auth0 access token
	const accessToken = await fetchAuth0Token(config);
	if (!accessToken) {
		throw new Error('Failed to obtain Auth0 access token');
	}

	// Get user info from Auth0
	const userInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
	if (!userInfo) {
		throw new Error('Failed to get user info from Auth0');
	}

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

	const auth: CachedAuth = {
		sessionId: loginData.data.sessionId,
		userInfo,
		accessToken,
		timestamp: Date.now()
	};

	console.log('✅ Fresh Auth0 authentication completed');
	return auth;
}

// Main function to get shared authentication
export async function getSharedAuth(): Promise<{
	sessionId: string;
	userInfo: { sub: string; email: string };
	accessToken: string;
}> {
	// Try to use cached auth first
	const cached = getCachedAuth();
	if (cached) {
		return cached;
	}

	// Perform fresh authentication and cache it
	const fresh = await performFreshAuth();
	cacheAuth(fresh);
	
	return fresh;
}

// Clear auth cache (for cleanup)
export function clearAuthCache(): void {
	try {
		if (existsSync(AUTH_CACHE_FILE)) {
			require('fs').unlinkSync(AUTH_CACHE_FILE);
			console.log('🗑️ Cleared auth cache');
		}
	} catch (error) {
		console.log('⚠️ Failed to clear auth cache:', error);
	}
}