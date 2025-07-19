import { describe, it, expect } from 'vitest';
import { 
	setupAuthTests, 
	testSessionId, 
	BASE_URL,
	createJsonHeaders,
	type ApiErrorResponse 
} from './helpers';

describe('Authentication API - Session Validation Tests', () => {
	setupAuthTests();

	describe('Session Authentication', () => {
		it('should validate session for authenticated requests', async () => {
			// 実際のセッション認証テストは他のAPIエンドポイントでテスト
			// ここではPOST /api/rolesを使用してセッション認証をテスト
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(testSessionId),
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(401); // 無効なセッションIDのため認証失敗
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBe('Session not found');
		});

		it('should reject requests without Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(null),
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with invalid Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'InvalidFormat'
				},
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with empty session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer '
				},
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle expired or invalid session IDs', async () => {
			const invalidSessionId = 'expired-or-invalid-session-id';
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders(invalidSessionId),
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBe('Session not found');
		});
	});
});