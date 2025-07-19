import { describe, it, expect } from 'vitest';
import { setupAuthTests, auth0Domain, BASE_URL, type ApiErrorResponse } from './helpers';

setupAuthTests();

describe('Error Handling', () => {
	it('should handle database errors gracefully', async () => {
		// データベースが存在しない環境での認証エラーハンドリング
		const response = await fetch(`${BASE_URL}/api/auth?code=test-code`, {
			method: 'GET'
		});

		// エラーが適切にハンドリングされることを確認
		expect([400, 500].includes(response.status)).toBe(true);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should handle Auth0 API errors', async () => {
		// 無効な認証コードでのAuth0 APIエラーハンドリング
		const invalidCode = 'definitely-invalid-code';
		const response = await fetch(`${BASE_URL}/api/auth?code=${invalidCode}`, {
			method: 'GET'
		});

		expect([400, 500].includes(response.status)).toBe(true);
		const data = await response.json() as ApiErrorResponse;
		expect(data.success).toBe(false);
		expect(data.error).toBeDefined();
	});

	it('should handle missing required parameters', async () => {
		// コードなしでのコールバック処理テスト
		const response = await fetch(`${BASE_URL}/api/auth`, {
			method: 'GET',
			redirect: 'manual'
		});

		// 認証URLへのリダイレクトまたはエラーが期待される
		expect([302, 500].includes(response.status)).toBe(true);

		// リダイレクトの場合はAuth0へのリダイレクトが期待される
		const location = response.headers.get('Location');
		expect(location || '').toContain(auth0Domain || 'auth0.com');
	});
});