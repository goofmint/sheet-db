import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from './helpers/auth';
// ローカル開発サーバーのベースURL

describe('Authentication API', () => {
	let testAuth0Code: string;
	let testSessionId: string;
	let validSessionId: string | null = null; // 実際の有効なセッションID

	// Auth0 test environment variables from cloudflare:test
	const auth0Domain = env.AUTH0_DOMAIN;
	const auth0ClientId = env.AUTH0_CLIENT_ID;
	const auth0ClientSecret = env.AUTH0_CLIENT_SECRET;
	const auth0TestEmail = env.AUTH0_TEST_EMAIL;
	const auth0TestPassword = env.AUTH0_TEST_PASSWORD;

	beforeAll(async () => {
		// Check environment variables from cloudflare:test
		if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
			throw new Error('Required Auth0 environment variables not found. Please ensure .dev.vars contains: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET');
		}

		if (!auth0TestEmail || !auth0TestPassword) {
			throw new Error('Required Auth0 test credentials not found. Please ensure .dev.vars contains: AUTH0_TEST_EMAIL, AUTH0_TEST_PASSWORD');
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
		it('should complete full Auth0 authentication flow (integration test)', async () => {
			// Resource Owner Password Grant を使用してブラウザレス認証をテスト
			const config = validateAuth0Config();
			expect(config).not.toBeNull();

			// Step 1: Auth0から直接アクセストークンを取得
			const accessToken = await fetchAuth0Token(config!);
			expect(accessToken).not.toBeNull();

			// Step 2: ユーザー情報を取得
			const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
			expect(userInfo).not.toBeNull();
			expect(userInfo!.email).toBe(auth0TestEmail);

			// Step 3: /api/login エンドポイントを使用してセッションを作成
			const loginResponse = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: accessToken,
					userInfo: {
						...userInfo,
						name: 'Test User',
						given_name: 'Test',
						family_name: 'User',
						nickname: 'testuser',
						picture: 'https://example.com/avatar.jpg',
						email_verified: true,
						locale: 'en'
					}
				})
			});

			expect([200, 201].includes(loginResponse.status)).toBe(true);
			const loginData = await loginResponse.json() as any;
			expect(loginData.success).toBe(true);
			expect(loginData.data).toHaveProperty('sessionId');
			expect(loginData.data).toHaveProperty('user');
			expect(loginData.data.user.email).toBe(auth0TestEmail);

			// セッションIDを保存してセッション認証テストで使用
			testSessionId = loginData.data.sessionId;
			validSessionId = loginData.data.sessionId;
		});
	});

	describe('Session Authentication', () => {
		// Note: This test must run after the Authentication Flow Integration tests
		// to ensure validSessionId is properly set
		it('should validate session for authenticated requests', async () => {
			// 有効なセッションIDが存在する場合は実際のセッションでテスト
			if (validSessionId) {
				const response = await fetch(`${BASE_URL}/api/roles`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${validSessionId}`
					},
					body: JSON.stringify({
						name: `test-role-${Date.now()}` // ユニークな名前を使用
					})
				});

				expect(response.status).toBe(200); // 有効なセッションIDで成功
				const data = await response.json() as { success: boolean; data?: any };
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('name');
			} else {
				// 有効なセッションIDがない場合は無効なセッションIDでテスト
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
				expect(data.error).toBe('Failed to fetch session data');
			}
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

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
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
			const data = await response.json() as { success: boolean; error: any };
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
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
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

	describe('POST /api/login', () => {
		it('should reject requests with missing token', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					userInfo: {
						sub: 'auth0|test123',
						email: 'test@example.com'
					}
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with missing userInfo', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: 'test-token'
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with invalid userInfo structure', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: 'test-token',
					userInfo: {
						// Missing required sub field
						email: 'test@example.com'
					}
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with invalid Auth0 token', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: 'invalid-auth0-token',
					userInfo: {
						sub: 'auth0|test123',
						email: 'test@example.com',
						name: 'Test User'
					}
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
			expect(data.error).toContain('token');
		});

		it('should successfully login with valid Auth0 token and user info (201 - new user)', async () => {
			// This test requires valid Auth0 configuration and credentials
			const config = validateAuth0Config();
			expect(config).not.toBeNull();

			// Get a real Auth0 token
			const accessToken = await fetchAuth0Token(config!);
			expect(accessToken).not.toBeNull();

			// Get user info from Auth0
			const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
			expect(userInfo).not.toBeNull();

			// Add additional user info fields for testing
			const fullUserInfo = {
				...userInfo,
				name: 'Test User',
				given_name: 'Test',
				family_name: 'User',
				nickname: 'testuser',
				picture: 'https://example.com/avatar.jpg',
				email_verified: true,
				locale: 'en'
			};

			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: accessToken,
					userInfo: fullUserInfo
				})
			});

			expect([200, 201].includes(response.status)).toBe(true);
			const data = await response.json() as {
				success: boolean;
				data: {
					sessionId: string;
					user: any;
					session: any;
				};
			};

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
			expect(data.data.session.id).toBe(data.data.sessionId);
			expect(data.data.session.user_id).toBe(userInfo!.sub);
			expect(data.data.session).toHaveProperty('expires_at');
			expect(data.data.session).toHaveProperty('created_at');
			expect(data.data.session).toHaveProperty('updated_at');
		});

		it('should successfully login with valid Auth0 token for existing user (200)', async () => {
			// This test requires valid Auth0 configuration and credentials
			// and that the previous test has run to create the user
			const config = validateAuth0Config();
			expect(config).not.toBeNull();

			// Get a real Auth0 token
			const accessToken = await fetchAuth0Token(config!);
			expect(accessToken).not.toBeNull();

			// Get user info from Auth0
			const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
			expect(userInfo).not.toBeNull();

			// Add additional user info fields for testing
			const fullUserInfo = {
				...userInfo,
				name: 'Test User Updated',
				given_name: 'Test',
				family_name: 'User',
				nickname: 'testuser',
				picture: 'https://example.com/avatar.jpg',
				email_verified: true,
				locale: 'en'
			};

			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: accessToken,
					userInfo: fullUserInfo
				})
			});

			// Should return 200 for existing user
			expect(response.status).toBe(200);
			const data = await response.json() as {
				success: boolean;
				data: {
					sessionId: string;
					user: any;
					session: any;
				};
			};

			expect(data.success).toBe(true);
			expect(data.data.user.id).toBe(userInfo!.sub);
			expect(data.data.user.email).toBe(userInfo!.email);
		});

		it('should handle Auth0 configuration errors gracefully', async () => {
			// Test with any token when Auth0 is not configured properly
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: 'any-token',
					userInfo: {
						sub: 'auth0|test123',
						email: 'test@example.com'
					}
				})
			});

			// Should handle missing configuration gracefully
			expect([400, 401, 500].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate email format in userInfo', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: 'test-token',
					userInfo: {
						sub: 'auth0|test123',
						email: 'invalid-email-format'
					}
				})
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle malformed JSON requests', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: '{invalid json}'
			});

			expect([400, 422].includes(response.status)).toBe(true);
		});

		it('should handle requests without Content-Type header', async () => {
			const response = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				body: JSON.stringify({
					token: 'test-token',
					userInfo: {
						sub: 'auth0|test123',
						email: 'test@example.com'
					}
				})
			});

			// Without Content-Type header, the body may not be parsed correctly
			// Most APIs return 400 (Bad Request) or 401 (Unauthorized) in this case
			expect([400, 401, 415].includes(response.status)).toBe(true);
		});
	});

	describe('POST /api/logout', () => {
		it('should successfully logout with valid session ID', async () => {
			// Use valid session ID if available from integration tests
			const sessionIdToUse = validSessionId || testSessionId;
			
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${sessionIdToUse}`
				}
			});

			// Logout should always return 200 even if session is not found
			expect(response.status).toBe(200);
			const data = await response.json() as { success: boolean; data: any };
			expect(data.success).toBe(true);
			expect(data.data).toEqual({});
		});

		it('should successfully logout with invalid session ID', async () => {
			const invalidSessionId = 'invalid-session-id-12345';
			
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${invalidSessionId}`
				}
			});

			// Logout should return 200 even for invalid sessions (graceful handling)
			expect(response.status).toBe(200);
			const data = await response.json() as { success: boolean; data: any };
			expect(data.success).toBe(true);
			expect(data.data).toEqual({});
		});

		it('should reject requests without Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST'
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with invalid Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': 'InvalidFormat'
				}
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should reject requests with empty Bearer token', async () => {
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer '
				}
			});

			expect(response.status).toBe(400);
			const data = await response.json() as { success: boolean; error: any };
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should handle logout after successful login', async () => {
			// This test verifies the full login -> logout flow
			const config = validateAuth0Config();
			expect(config).not.toBeNull();

			// Get a real Auth0 token
			const accessToken = await fetchAuth0Token(config!);
			expect(accessToken).not.toBeNull();

			// Get user info from Auth0
			const userInfo = await fetchAuth0UserInfo(config!.auth0Domain, accessToken!);
			expect(userInfo).not.toBeNull();

			// Step 1: Login to get session ID
			const loginResponse = await fetch(`${BASE_URL}/api/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					token: accessToken,
					userInfo: {
						...userInfo,
						name: 'Test User for Logout',
						given_name: 'Test',
						family_name: 'User',
						nickname: 'testuser',
						picture: 'https://example.com/avatar.jpg',
						email_verified: true,
						locale: 'en'
					}
				})
			});

			expect([200, 201].includes(loginResponse.status)).toBe(true);
			const loginData = await loginResponse.json() as any;
			expect(loginData.success).toBe(true);
			
			const sessionId = loginData.data.sessionId;
			expect(sessionId).toBeDefined();

			// Step 2: Use the session for an authenticated request (verify it works)
			const roleTestResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${sessionId}`
				}
			});

			expect(roleTestResponse.status).toBe(200);
			
			// Step 3: Logout using the session ID
			const logoutResponse = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${sessionId}`
				}
			});

			expect(logoutResponse.status).toBe(200);
			const logoutData = await logoutResponse.json() as { success: boolean; data: any };
			expect(logoutData.success).toBe(true);
			expect(logoutData.data).toEqual({});

			// Step 4: Verify the session is no longer valid
			const invalidSessionResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${sessionId}`
				},
				body: JSON.stringify({
					name: `test-role-after-logout-${Date.now()}`
				})
			});

			// Should fail with 401 since session was cleared
			expect(invalidSessionResponse.status).toBe(401);
			const invalidSessionData = await invalidSessionResponse.json() as { success: boolean; error: string };
			expect(invalidSessionData.success).toBe(false);
			expect(invalidSessionData.error).toBe('Session not found');
		});

		it('should handle multiple logout requests gracefully', async () => {
			// Use any session ID (valid or invalid)
			const sessionIdToUse = validSessionId || 'test-session-for-multiple-logout';
			
			// First logout
			const firstLogoutResponse = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${sessionIdToUse}`
				}
			});

			expect(firstLogoutResponse.status).toBe(200);
			const firstLogoutData = await firstLogoutResponse.json() as { success: boolean; data: any };
			expect(firstLogoutData.success).toBe(true);

			// Second logout with same session ID (should still succeed)
			const secondLogoutResponse = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${sessionIdToUse}`
				}
			});

			expect(secondLogoutResponse.status).toBe(200);
			const secondLogoutData = await secondLogoutResponse.json() as { success: boolean; data: any };
			expect(secondLogoutData.success).toBe(true);
		});

		it('should handle logout with expired session gracefully', async () => {
			// Use an expired-looking session ID
			const expiredSessionId = 'expired-session-12345';
			
			const response = await fetch(`${BASE_URL}/api/logout`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${expiredSessionId}`
				}
			});

			// Should still return success for expired sessions
			expect(response.status).toBe(200);
			const data = await response.json() as { success: boolean; data: any };
			expect(data.success).toBe(true);
			expect(data.data).toEqual({});
		});
	});
});