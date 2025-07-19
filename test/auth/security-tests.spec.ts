import { describe, it, expect } from 'vitest';
import { setupAuthTests, auth0ClientSecret, BASE_URL, type ApiErrorResponse } from './helpers';

setupAuthTests();

describe('Security Tests', () => {
	it('should handle HTTPS validation in development environment', async () => {
		// 開発環境での認証URLの生成テスト
		const response = await fetch(`${BASE_URL}/api/auth`, {
			method: 'GET',
			redirect: 'manual'
		});

		// 開発環境ではHTTPでも動作するが、本番ではHTTPS必須
		expect([302, 500].includes(response.status)).toBe(true);

		// リダイレクトの場合はHTTPSでのAuth0 URLが期待される
		const location = response.headers.get('Location');
		expect(location || '').toContain('https://'); // Auth0 URLはHTTPS
	});

	it('should handle CSRF protection with state parameter', async () => {
		// ステートパラメータでのCSRF保護テスト
		const stateParam = 'csrf-test-state-123';
		const response = await fetch(`${BASE_URL}/api/auth?state=${stateParam}`, {
			method: 'GET',
			redirect: 'manual'
		});

		expect([302, 500].includes(response.status)).toBe(true);

		// リダイレクトの場合はセキュアなstateパラメータが期待される
		const location = response.headers.get('Location');
		expect(location || '').toContain('state=');
		const url = new URL(location!);
		const generatedState = url.searchParams.get('state');
		expect(generatedState).toBeDefined();
		expect(generatedState?.length).toBeGreaterThan(30);
	});

	it('should not expose sensitive information in error messages', async () => {
		const response = await fetch(`${BASE_URL}/api/auth?code=invalid`, {
			method: 'GET'
		});

		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);

		// エラーメッセージが機密情報を含まないことを確認
		expect(data.error).not.toContain(auth0ClientSecret || '');
		expect(data.error).not.toContain('password');
		expect(data.error).not.toContain('secret');
	});
});