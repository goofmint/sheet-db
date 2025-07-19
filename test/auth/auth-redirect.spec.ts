import { describe, it, expect } from 'vitest';
import { 
	setupAuthTests, 
	testAuth0Code, 
	auth0Domain, 
	auth0ClientId, 
	BASE_URL,
	type ApiResponse,
	type AuthCallbackResponse,
	type ApiErrorResponse 
} from './helpers';

describe('Authentication API - Redirect Tests', () => {
	setupAuthTests();

	describe('GET /api/auth', () => {
		it('should redirect to Auth0 authorization URL when no code provided', async () => {
			const response = await fetch(`${BASE_URL}/api/auth`, {
				method: 'GET',
				redirect: 'manual' // リダイレクトを手動で処理
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toBeDefined();
			
			// 環境変数が設定されている場合のみ詳細チェック
			expect(location).toContain(auth0Domain || 'auth0.com');
			
			expect(location).toContain('response_type=code');
			
			expect(auth0ClientId).toBeDefined();
			expect(location).toContain('client_id=' + auth0ClientId);
			
			expect(location).toContain('scope=openid+profile+email');
		});

		it('should handle Auth0 callback when code is provided', async () => {
			// 無効な認証コードでのテスト
			const response = await fetch(`${BASE_URL}/api/auth?code=${testAuth0Code}`, {
				method: 'GET'
			});

			// 無効なコードなので400または500エラーが期待される
			expect([400, 500].includes(response.status)).toBe(true);

			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();

			// Auth0 APIエラーが期待される
			expect(['Failed to exchange authorization code for tokens', 'Failed to fetch user information from Auth0', 'Authentication failed'].some(msg =>
				data.error?.includes(msg)
			)).toBe(true);
		});

		it('should handle invalid authorization code', async () => {
			const invalidCode = 'invalid-auth-code-xyz';
			const response = await fetch(`${BASE_URL}/api/auth?code=${invalidCode}`, {
				method: 'GET'
			});

			expect([400, 500].includes(response.status)).toBe(true);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});