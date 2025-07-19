import { describe, it, expect } from 'vitest';
import { setupAuthTests, createJsonHeaders, BASE_URL, type ApiErrorResponse, type AuthCallbackResponse } from './helpers';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo } from '../helpers/auth';

setupAuthTests();

describe('POST /api/login - Integration', () => {
	it.skip('should successfully login with valid Auth0 token and user info (201 - new user)', async () => {
		// This test requires valid Auth0 configuration and credentials
		const config = validateAuth0Config();
		expect(config).toBeDefined();

		// Get a real Auth0 token
		const accessToken = await fetchAuth0Token(config!);
		expect(accessToken).toBeDefined();

		// Get user info from Auth0
		const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
		expect(userInfo).toBeDefined();

		// Add additional user info fields for testing
		const fullUserInfo = {
			...userInfo!,
			name: 'Test User',
			given_name: 'Test',
			family_name: 'User',
			nickname: 'testuser',
			picture: 'https://example.com/avatar.jpg',
			email_verified: true,
			locale: 'en',
		};

		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: accessToken!,
				userInfo: fullUserInfo,
			}),
		});

		expect([200, 201].includes(response.status)).toBe(true);
		const data = (await response.json()) as AuthCallbackResponse;

		expect(data.success).toBe(true);
		expect(data.data).toHaveProperty('sessionId');
		expect(data.data).toHaveProperty('user');
		expect(data.data).toHaveProperty('session');

		// Validate user data
		expect(data.data.user.id).toBe(userInfo!.sub);
		expect(data.data.user.email).toBe(userInfo!.email);
		expect(data.data.user).toHaveProperty('created_at');
		expect(data.data.user).toHaveProperty('updated_at');

		// Validate session data
		if (!data.data.session) throw new Error('Session data is missing');
		expect(data.data.session.id).toBe(data.data.sessionId);
		expect(data.data.session.user_id).toBe(userInfo!.sub);
		expect(data.data.session).toHaveProperty('expires_at');
		expect(data.data.session).toHaveProperty('created_at');
		expect(data.data.session).toHaveProperty('updated_at');
	});

	it.skip('should successfully login with valid Auth0 token for existing user (200)', async () => {
		// This test requires valid Auth0 configuration and credentials
		// and that the previous test has run to create the user
		const config = validateAuth0Config();
		expect(config).toBeDefined();

		// Get a real Auth0 token
		const accessToken = await fetchAuth0Token(config!);
		expect(accessToken).toBeDefined();

		// Get user info from Auth0
		const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
		expect(userInfo).toBeDefined();

		// Add additional user info fields for testing
		const fullUserInfo = {
			...userInfo!,
			name: 'Test User Updated',
			given_name: 'Test',
			family_name: 'User',
			nickname: 'testuser',
			picture: 'https://example.com/avatar.jpg',
			email_verified: true,
			locale: 'en',
		};

		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: accessToken!,
				userInfo: fullUserInfo,
			}),
		});

		// Should return 200 for existing user
		expect(response.status).toBe(200);
		const data = (await response.json()) as AuthCallbackResponse;

		expect(data.success).toBe(true);
		expect(data.data.user.id).toBe(userInfo!.sub);
		expect(data.data.user.email).toBe(userInfo!.email);
	});

	it('should handle Auth0 configuration errors gracefully', async () => {
		// Test with any token when Auth0 is not configured properly
		const response = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: createJsonHeaders(null),
			body: JSON.stringify({
				token: 'any-token',
				userInfo: {
					sub: 'auth0|test123',
					email: 'test@example.com',
				},
			}),
		});

		// Should handle missing configuration gracefully
		expect([400, 401, 500].includes(response.status)).toBe(true);
		const data = (await response.json()) as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});
});
