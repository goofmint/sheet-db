import { describe, it, expect } from 'vitest';
import { setupAuthTests, auth0Domain, auth0ClientId, auth0ClientSecret, auth0TestEmail, auth0TestPassword, BASE_URL } from './helpers';

setupAuthTests();

describe('Auth0 Configuration Validation', () => {
	it('should have required Auth0 environment variables', () => {
		expect(auth0Domain).toBeDefined();
		expect(auth0ClientId).toBeDefined();
		expect(auth0ClientSecret).toBeDefined();

		expect(auth0Domain).toContain('.auth0.com');
		expect(auth0ClientId!.length).toBeGreaterThan(0);
		expect(auth0ClientSecret!.length).toBeGreaterThan(0);
	});

	it('should have test credentials for integration testing', () => {
		// テスト用の認証情報が設定されているかチェック
		expect(auth0TestEmail).toBeDefined();
		expect(auth0TestPassword).toBeDefined();
		expect(auth0TestEmail!).toContain('@');
		expect(auth0TestPassword!.length).toBeGreaterThan(0);
	});
});

describe('Auth0 URL Generation', () => {
	it('should generate correct Auth0 authorization URL', async () => {
		expect(auth0Domain).toBeDefined();
		expect(auth0ClientId).toBeDefined();

		const response = await fetch(`${BASE_URL}/api/auth`, {
			method: 'GET',
			redirect: 'manual'
		});

		expect(response.status).toBe(302);
		const location = response.headers.get('Location');
		expect(location).toBeDefined();

		const url = new URL(location!);
		expect(url.hostname).toContain('auth0.com');
		expect(url.pathname).toBe('/authorize');

		// クエリパラメータの検証
		const searchParams = url.searchParams;
		expect(searchParams.get('response_type')).toBe('code');
		expect(searchParams.get('client_id')).toBe(auth0ClientId);
		expect(searchParams.get('scope')).toBe('openid profile email');
		expect(searchParams.get('redirect_uri')).toBeDefined();
		expect(searchParams.get('redirect_uri')).toContain('/api/auth/callback');
	});

	it('should generate secure state parameter', async () => {
		const stateParam = 'test-state-123';
		const response = await fetch(`${BASE_URL}/api/auth?state=${stateParam}`, {
			method: 'GET',
			redirect: 'manual'
		});

		expect(response.status).toBe(302);
		const location = response.headers.get('Location');
		expect(location).toBeDefined();

		const url = new URL(location!);
		// APIは独自のセキュアなstateパラメータを生成する
		const generatedState = url.searchParams.get('state');
		expect(generatedState).toBeDefined();
		expect(generatedState?.length).toBeGreaterThan(30); // UUIDのような長い値
	});
});