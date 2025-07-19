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
} | null {
	const auth0Domain = env.AUTH0_DOMAIN;
	const auth0ClientId = env.AUTH0_CLIENT_ID;
	const auth0ClientSecret = env.AUTH0_CLIENT_SECRET;
	const testEmail = env.AUTH0_TEST_EMAIL;
	const testPassword = env.AUTH0_TEST_PASSWORD;

	if (!auth0Domain || !auth0ClientId || !auth0ClientSecret || !testEmail || !testPassword) {
		console.log('Auth0 configuration incomplete');
		return null;
	}

	return { auth0Domain, auth0ClientId, auth0ClientSecret, testEmail, testPassword };
}

// Fetch Auth0 access token
export async function fetchAuth0Token(config: {
	auth0Domain: string;
	auth0ClientId: string;
	auth0ClientSecret: string;
	testEmail: string;
	testPassword: string;
}): Promise<string | null> {
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

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.log(`Auth0 token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`, errorText);
			console.log('Resource Owner Password Grant may not be enabled in Auth0 dashboard');
			return null;
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
		return null;
	}
}

// Fetch user info using Auth0 token
export async function fetchAuth0UserInfo(auth0Domain: string, accessToken: string): Promise<{ sub: string; email: string } | null> {
	try {
		const userInfoResponse = await fetch(`https://${auth0Domain}/userinfo`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!userInfoResponse.ok) {
			const errorText = await userInfoResponse.text();
			console.log(`Auth0 user info request failed: ${userInfoResponse.status} ${userInfoResponse.statusText}`, errorText);
			return null;
		}

		const userInfo = await userInfoResponse.json() as { sub: string; email: string; name?: string; given_name?: string; family_name?: string; nickname?: string; picture?: string; email_verified?: boolean; locale?: string };
		if (!userInfo.sub || !userInfo.email) {
			console.log('Auth0 user info incomplete');
			return null;
		}

		return { sub: userInfo.sub, email: userInfo.email };
	} catch (error) {
		console.log('Auth0 user info request error:', error);
		return null;
	}
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
		if (!config) {
			return null;
		}

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