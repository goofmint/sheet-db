import { describe, it, expect, beforeAll } from 'vitest';

// ローカル開発サーバーのベースURL
const BASE_URL = 'http://localhost:8787';

describe('Authentication API', () => {
	let testAuth0Code: string;
	let testSessionId: string;

	// Auth0テスト用の環境変数（.dev.varsまたは.envから読み込み）
	const auth0Domain = process.env.AUTH0_DOMAIN;
	const auth0ClientId = process.env.AUTH0_CLIENT_ID;
	const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;
	const auth0TestEmail = process.env.AUTH0_TEST_EMAIL;
	const auth0TestPassword = process.env.AUTH0_TEST_PASSWORD;

	beforeAll(async () => {
		// 環境変数の確認（.dev.varsまたは.envから読み込まれているかチェック）
		if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
			console.log('Warning: Required Auth0 environment variables not found. Some tests may be skipped.');
			console.log('Please ensure .dev.vars or .env contains: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET');
		}

		// テスト用のモックデータ
		testAuth0Code = 'test-auth-code-123';
		testSessionId = 'test-session-uuid-456';
	});

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
			if (auth0Domain) {
				expect(location).toContain(auth0Domain);
			} else {
				expect(location).toContain('auth0.com');
			}
			
			expect(location).toContain('response_type=code');
			
			if (auth0ClientId) {
				expect(location).toContain('client_id=' + auth0ClientId);
			}
			
			expect(location).toContain('scope=openid+profile+email');
		});

		it('should handle Auth0 callback when code is provided', async () => {
			// 無効な認証コードでのテスト
			const response = await fetch(`${BASE_URL}/api/auth?code=${testAuth0Code}`, {
				method: 'GET'
			});

			// 無効なコードなので400または500エラーが期待される
			expect([400, 500].includes(response.status)).toBe(true);

			const data = await response.json() as { success: boolean; error?: string; sessionId?: string; user?: any };
			expect(data).toHaveProperty('success');
			expect(data.success).toBe(false);
			expect(data).toHaveProperty('error');

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
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});

	describe('GET /api/auth/callback', () => {
		it('should redirect to GET /api/auth', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toBe(`${BASE_URL}/api/auth`);
		});

		it('should preserve query parameters in redirect', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback?code=test123&state=xyz`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect(response.status).toBe(302);
			const location = response.headers.get('Location');
			expect(location).toBe(`${BASE_URL}/api/auth?code=test123&state=xyz`);
		});
	});

	describe('POST /api/auth/callback', () => {
		it('should handle POST requests and return error', async () => {
			const response = await fetch(`${BASE_URL}/api/auth/callback`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					code: 'test-code'
				})
			});

			// POSTメソッドでも認証コードの交換を試みる
			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Failed to exchange authorization code');
		});
	});

	describe('Authentication Flow Integration', () => {
		it.skip('should complete full Auth0 authentication flow (integration test)', async () => {
			// この統合テストは実際のAuth0環境でのみ実行可能
			// Auth0テストユーザーでの認証フローをテスト

			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL or AUTH0_TEST_PASSWORD not configured');
				return;
			}

			// Step 1: Auth0認証URLの取得
			const authResponse = await fetch(`${BASE_URL}/api/auth`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect(authResponse.status).toBe(302);
			const authUrl = authResponse.headers.get('Location');
			expect(authUrl).toBeDefined();

			// Step 2: 実際のAuth0認証は手動またはPuppeteer等が必要
			// ここではモックの認証コードでテスト
			console.log('Auth0 URL for manual testing:', authUrl);

			// Step 3: 認証成功後のコールバック処理をテスト
			// 実際の環境では有効な認証コードが必要
			const callbackResponse = await fetch(`${BASE_URL}/api/auth?code=valid-test-code`, {
				method: 'GET'
			});

			const callbackData = await callbackResponse.json() as any;

			if (callbackData.success) {
				expect(callbackData).toHaveProperty('sessionId');
				expect(callbackData).toHaveProperty('user');
				expect(callbackData.user.email).toBe(auth0TestEmail);

				// セッションIDを保存してセッション認証テストで使用
				testSessionId = callbackData.sessionId;
			} else {
				console.log('Authentication failed (expected in test environment):', callbackData.error);
			}
		});
	});

	describe('Session Authentication', () => {
		it('should validate session for authenticated requests', async () => {
			// 実際のセッション認証テストは他のAPIエンドポイントでテスト
			// ここではPOST /api/rolesを使用してセッション認証をテスト
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${testSessionId}`
				},
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(401); // 無効なセッションIDのため認証失敗
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBe('Session not found');
		});

		it('should reject requests without Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authorization header');
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

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Bearer token');
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

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authorization header with Bearer token is required');
		});

		it('should handle expired or invalid session IDs', async () => {
			const invalidSessionId = 'expired-or-invalid-session-id';
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${invalidSessionId}`
				},
				body: JSON.stringify({
					name: 'test-role'
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBe('Session not found');
		});
	});

	describe('Auth0 Configuration Validation', () => {
		it('should have required Auth0 environment variables', () => {
			if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
				console.log('Skipping test: Auth0 environment variables not configured');
				return;
			}

			expect(auth0Domain).toBeDefined();
			expect(auth0ClientId).toBeDefined();
			expect(auth0ClientSecret).toBeDefined();

			expect(auth0Domain).toContain('.auth0.com');
			expect(auth0ClientId.length).toBeGreaterThan(0);
			expect(auth0ClientSecret.length).toBeGreaterThan(0);
		});

		it('should have test credentials for integration testing', () => {
			// テスト用の認証情報が設定されているかチェック
			if (auth0TestEmail && auth0TestPassword) {
				expect(auth0TestEmail).toContain('@');
				expect(auth0TestPassword.length).toBeGreaterThan(0);
			} else {
				console.log('Warning: AUTH0_TEST_EMAIL and AUTH0_TEST_PASSWORD not configured for integration tests');
			}
		});
	});

	describe('Auth0 URL Generation', () => {
		it('should generate correct Auth0 authorization URL', async () => {
			if (!auth0Domain || !auth0ClientId) {
				console.log('Skipping test: Auth0 environment variables not configured');
				return;
			}

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

	describe('Error Handling', () => {
		it('should handle database errors gracefully', async () => {
			// データベースが存在しない環境での認証エラーハンドリング
			const response = await fetch(`${BASE_URL}/api/auth?code=test-code`, {
				method: 'GET'
			});

			// エラーが適切にハンドリングされることを確認
			expect([400, 500].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
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
			const data = await response.json() as { success: boolean; error: string };
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

			if (response.status === 302) {
				// 正常にAuth0へのリダイレクトが生成された場合
				const location = response.headers.get('Location');
				if (auth0Domain) {
					expect(location).toContain(auth0Domain);
				} else {
					expect(location).toContain('auth0.com');
				}
			} else {
				// エラーが発生した場合
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});

	describe('Security Tests', () => {
		it('should handle HTTPS validation in development environment', async () => {
			// 開発環境での認証URLの生成テスト
			const response = await fetch(`${BASE_URL}/api/auth`, {
				method: 'GET',
				redirect: 'manual'
			});

			// 開発環境ではHTTPでも動作するが、本番ではHTTPS必須
			expect([302, 500].includes(response.status)).toBe(true);

			if (response.status === 302) {
				const location = response.headers.get('Location');
				expect(location).toContain('https://'); // Auth0 URLはHTTPS
			} else {
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should handle CSRF protection with state parameter', async () => {
			// ステートパラメータでのCSRF保護テスト
			const stateParam = 'csrf-test-state-123';
			const response = await fetch(`${BASE_URL}/api/auth?state=${stateParam}`, {
				method: 'GET',
				redirect: 'manual'
			});

			expect([302, 500].includes(response.status)).toBe(true);

			if (response.status === 302) {
				const location = response.headers.get('Location');
				// APIは独自のセキュアなstateパラメータを生成する
				expect(location).toContain('state=');
				const url = new URL(location!);
				const generatedState = url.searchParams.get('state');
				expect(generatedState).toBeDefined();
				expect(generatedState?.length).toBeGreaterThan(30);
			} else {
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});

		it('should not expose sensitive information in error messages', async () => {
			const response = await fetch(`${BASE_URL}/api/auth?code=invalid`, {
				method: 'GET'
			});

			const data = await response.json() as { success: boolean; error: string };

			if (!data.success && auth0ClientSecret) {
				// エラーメッセージが機密情報を含まないことを確認
				expect(data.error).not.toContain(auth0ClientSecret);
				expect(data.error).not.toContain('password');
				expect(data.error).not.toContain('secret');
			}
		});
	});
});