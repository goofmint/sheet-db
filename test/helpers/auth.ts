import { env } from 'cloudflare:test';

// Local development server base URL
export const BASE_URL = 'http://localhost:8787';

// Auth0 configuration validation
export function validateAuth0Config(): {
	auth0Domain: string;
	auth0ClientId: string;
	auth0ClientSecret: string;
	testEmail: string;
	testPassword: string;
} {
	const auth0Domain = env.AUTH0_DOMAIN;
	const auth0ClientId = env.AUTH0_CLIENT_ID;
	const auth0ClientSecret = env.AUTH0_CLIENT_SECRET;
	const testEmail = env.AUTH0_TEST_EMAIL;
	const testPassword = env.AUTH0_TEST_PASSWORD;

	// Debug: Log what we actually got
	console.log('Auth0 config check:', {
		auth0Domain: auth0Domain ? 'SET' : 'MISSING',
		auth0ClientId: auth0ClientId ? 'SET' : 'MISSING',
		auth0ClientSecret: auth0ClientSecret ? 'SET' : 'MISSING',
		testEmail: testEmail ? 'SET' : 'MISSING',
		testPassword: testPassword ? 'SET' : 'MISSING'
	});

	if (!auth0Domain || !auth0ClientId || !auth0ClientSecret || !testEmail || !testPassword) {
		const missing = [];
		if (!auth0Domain) missing.push('AUTH0_DOMAIN');
		if (!auth0ClientId) missing.push('AUTH0_CLIENT_ID');
		if (!auth0ClientSecret) missing.push('AUTH0_CLIENT_SECRET');
		if (!testEmail) missing.push('AUTH0_TEST_EMAIL');
		if (!testPassword) missing.push('AUTH0_TEST_PASSWORD');
		
		throw new Error(`Auth0 configuration incomplete. Missing environment variables: ${missing.join(', ')}. Tests cannot run without proper Auth0 setup.`);
	}

	return { auth0Domain, auth0ClientId, auth0ClientSecret, testEmail, testPassword };
}

// Delay function for rate limiting
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Remove artificial rate limiting since Auth0 is working correctly

// Fetch Auth0 access token with aggressive retry logic
export async function fetchAuth0Token(config: {
	auth0Domain: string;
	auth0ClientId: string;
	auth0ClientSecret: string;
	testEmail: string;
	testPassword: string;
}): Promise<string | null> {
	const maxRetries = 5; // Increased from 3
	let retryCount = 0;
	
	while (retryCount < maxRetries) {
		try {
			const tokenResponse = await fetch(`https://${config.auth0Domain}/oauth/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'password',
					username: config.testEmail,
					password: config.testPassword,
					client_id: config.auth0ClientId,
					client_secret: config.auth0ClientSecret,
					scope: 'openid profile email',
				}),
			});

			if (tokenResponse.status === 429) {
				// Rate limited, wait and retry with longer backoff
				const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff: 5s, 10s, 20s, 40s, 80s
				console.log(`🔴 Auth0 rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
				await delay(waitTime);
				retryCount++;
				continue;
			}

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				console.log(`🔍 DETAILED AUTH0 TOKEN ERROR:
  Status: ${tokenResponse.status}
  Status Text: ${tokenResponse.statusText}
  Headers: ${JSON.stringify(Object.fromEntries(tokenResponse.headers.entries()), null, 2)}
  Response Body: ${errorText}
  Retry Attempt: ${retryCount + 1}/${maxRetries}`);
				
				// Don't immediately return null, let's retry if it's not a permanent error
				if (tokenResponse.status === 400 || tokenResponse.status === 401 || tokenResponse.status === 403) {
					// These are likely configuration issues, don't retry
					console.log('🚫 Permanent Auth0 error, not retrying');
					return null;
				}
				// For other errors, retry
				retryCount++;
				if (retryCount >= maxRetries) {
					console.log('🚫 Max retries reached for Auth0 token request');
					return null;
				}
				await delay(1000 * retryCount); // Wait before retry
				continue;
			}

			const tokens = (await tokenResponse.json()) as {
				access_token: string;
				token_type: string;
				expires_in: number;
			};

			if (!tokens.access_token) {
				console.log('Auth0 token response invalid');
				return null;
			}

			return tokens.access_token;
			
		} catch (error) {
			console.log('Auth0 token request error:', error);
			retryCount++;
			if (retryCount >= maxRetries) {
				return null;
			}
			// Wait before retrying
			await delay(1000 * retryCount);
		}
	}
	
	return null; // All retries exhausted
}

// Fetch user info using Auth0 token with retry logic
export async function fetchAuth0UserInfo(auth0Domain: string, accessToken: string): Promise<{ sub: string; email: string } | null> {
	const maxRetries = 5; // Increased from 3
	let retryCount = 0;
	
	while (retryCount < maxRetries) {
		try {
			const userInfoResponse = await fetch(`https://${auth0Domain}/userinfo`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (userInfoResponse.status === 429) {
				// Rate limited, wait and retry with longer backoff
				const waitTime = Math.pow(2, retryCount) * 5000; // Exponential backoff: 5s, 10s, 20s, 40s, 80s
				console.log(`🔴 Auth0 user info rate limited, waiting ${waitTime}ms before retry ${retryCount + 1}/${maxRetries}`);
				await delay(waitTime);
				retryCount++;
				continue;
			}

			if (!userInfoResponse.ok) {
				const errorText = await userInfoResponse.text();
				console.log(`🔍 DETAILED AUTH0 USERINFO ERROR:
  Status: ${userInfoResponse.status}
  Status Text: ${userInfoResponse.statusText}
  Headers: ${JSON.stringify(Object.fromEntries(userInfoResponse.headers.entries()), null, 2)}
  Response Body: ${errorText}
  Access Token (first 20 chars): ${accessToken.substring(0, 20)}...
  Retry Attempt: ${retryCount + 1}/${maxRetries}`);
				
				// Don't immediately return null, let's retry if it's not a permanent error
				if (userInfoResponse.status === 400 || userInfoResponse.status === 401 || userInfoResponse.status === 403) {
					// These are likely token/auth issues, don't retry
					console.log('🚫 Permanent Auth0 userinfo error, not retrying');
					return null;
				}
				// For other errors, retry
				retryCount++;
				if (retryCount >= maxRetries) {
					console.log('🚫 Max retries reached for Auth0 userinfo request');
					return null;
				}
				await delay(1000 * retryCount); // Wait before retry
				continue;
			}

			const userInfo = await userInfoResponse.json() as { sub: string; email: string; name?: string; given_name?: string; family_name?: string; nickname?: string; picture?: string; email_verified?: boolean; locale?: string };
			if (!userInfo.sub || !userInfo.email) {
				console.log('Auth0 user info incomplete');
				return null;
			}

			return { sub: userInfo.sub, email: userInfo.email };
			
		} catch (error) {
			console.log('Auth0 user info request error:', error);
			retryCount++;
			if (retryCount >= maxRetries) {
				return null;
			}
			// Wait before retrying
			await delay(1000 * retryCount);
		}
	}
	
	return null; // All retries exhausted
}

// Create test session ID
export async function createTestSession(userInfo: { sub: string; email: string }): Promise<string | null> {
	try {
		// Test auth endpoint availability
		const authStartResponse = await fetch(`${BASE_URL}/api/auth`, {
			method: 'GET',
		});

		if (authStartResponse.ok) {
			// Generate test session ID for testing purposes
			const sessionId = `test-session-${userInfo.sub}-${Date.now()}`;
			return sessionId;
		} else {
			console.log('Auth endpoint unavailable');
			return null;
		}
	} catch (error) {
		console.log('Session creation failed');
		return null;
	}
}

// Main Auth0 authentication helper for tests
export async function authenticateWithAuth0(): Promise<string | null> {
	try {
		console.log('Starting Auth0 authentication...');

		const config = validateAuth0Config();

		const accessToken = await fetchAuth0Token(config);
		if (!accessToken) {
			return null;
		}

		console.log('Auth0 token obtained successfully');

		const userInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
		if (!userInfo) {
			return null;
		}

		console.log('Auth0 user info obtained successfully');

		const sessionId = await createTestSession(userInfo);
		if (!sessionId) {
			return null;
		}

		console.log('Test session created successfully');
		return sessionId;
	} catch (error) {
		console.log('Auth0 authentication process failed');
		return null;
	}
}

// Get authentication environment variables
export function getAuth0TestCredentials() {
	return {
		email: env.AUTH0_TEST_EMAIL,
		password: env.AUTH0_TEST_PASSWORD
	};
}