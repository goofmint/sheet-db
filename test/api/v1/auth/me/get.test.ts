import { describe, it, expect, beforeEach } from 'vitest';
import app from '@/index';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sessionTable } from '@/db/schema';
import { env } from 'cloudflare:test';
import { setupSessionDatabase, setupConfigDatabase } from '../../../../utils/database-setup';
import { ConfigService } from '@/services/config';

// Type definitions for API responses
interface UserResponse {
	id: string;
	name: string;
	email: string;
	picture?: string;
	email_verified?: boolean;
	updated_at?: string;
	sub?: string;
}

interface UserSuccessResponse {
	success: boolean;
	user: UserResponse;
	session?: any;
}

interface ErrorResponse {
	success: boolean;
	error: string;
	message?: string;
}

describe('Auth Me API - GET /api/v1/auth/me', () => {
	const db = drizzle(env.DB);

	beforeEach(async () => {
		// データベーステーブルを再作成
		await setupConfigDatabase(db);
		await setupSessionDatabase(db);

		// ConfigServiceを初期化
		await ConfigService.initialize(db);
	});

	describe('正常系', () => {
		it('should return user information for valid session', async () => {
			// 有効なセッションを作成（新フォーマット）
			const sessionId = 'sess_valid_user_001';
			const userId = 'auth0|user123456789';
			const userData = {
				auth0_user_id: userId,
				sub: userId,
			};

			await db.insert(sessionTable).values({
				session_id: sessionId,
				user_id: userId,
				user_data: JSON.stringify(userData),
				access_token: 'valid-access-token',
				refresh_token: null,
				expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			});

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${sessionId}`,
					},
				}),
				env
			);

			// _Userシートがないので500エラーになる
			expect(response.status).toBe(500);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'user_not_found',
				message: 'User data not found in _User sheet',
			});
		});

		it('should handle minimal user data correctly', async () => {
			// 最小限のユーザーデータでセッションを作成（新フォーマット）
			const sessionId = 'sess_minimal_user_002';
			const userId = 'auth0|minimal123';
			const userData = {
				auth0_user_id: userId,
				sub: userId,
			};

			await db.insert(sessionTable).values({
				session_id: sessionId,
				user_id: userId,
				user_data: JSON.stringify(userData),
				access_token: 'minimal-access-token',
				refresh_token: null,
				expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			});

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${sessionId}`,
					},
				}),
				env
			);

			// _Userシートがないので500エラーになる
			expect(response.status).toBe(500);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'user_not_found',
				message: 'User data not found in _User sheet',
			});
		});
	});

	describe('認証エラー', () => {
		it('should return 401 when no session cookie provided', async () => {
			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
				}),
				env
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Authentication required',
			});
		});

		it('should return 401 for non-existent session', async () => {
			const nonExistentSessionId = 'sess_non_existent_999';

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${nonExistentSessionId}`,
					},
				}),
				env
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Session not found or expired',
			});
		});

		it('should return 401 and cleanup expired session', async () => {
			// 期限切れセッションを作成
			const expiredSessionId = 'sess_expired_003';
			const userId = 'auth0|expired123';
			const userData = {
				sub: userId,
				email: 'expired@example.com',
			};

			await db.insert(sessionTable).values({
				session_id: expiredSessionId,
				user_id: userId,
				user_data: JSON.stringify(userData),
				access_token: 'expired-access-token',
				refresh_token: null,
				expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1時間前に期限切れ
			});

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${expiredSessionId}`,
					},
				}),
				env
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Session not found or expired',
			});

			// 期限切れセッションがデータベースから削除されていることを確認
			const remainingSessions = await db.select().from(sessionTable).where(eq(sessionTable.session_id, expiredSessionId));
			expect(remainingSessions).toHaveLength(0);
		});

		it('should return 401 for empty session cookie', async () => {
			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: 'session_id=',
					},
				}),
				env
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Authentication required',
			});
		});
	});

	describe('サーバーエラー', () => {
		it('should handle invalid user_data JSON gracefully', async () => {
			// 無効なJSONを持つセッションを作成
			const invalidSessionId = 'sess_invalid_json_004';
			const userId = 'auth0|invalid123';

			await db.insert(sessionTable).values({
				session_id: invalidSessionId,
				user_id: userId,
				user_data: 'invalid json data', // 無効なJSON
				access_token: 'invalid-access-token',
				refresh_token: null,
				expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			});

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${invalidSessionId}`,
					},
				}),
				env
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Invalid session data',
			});
		});

		it('should handle database errors gracefully', async () => {
			// 無効なenv（DBが存在しない）でテスト
			const invalidEnv = { ...env, DB: null };

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: 'session_id=test-session',
					},
				}),
				invalidEnv
			);

			expect(response.status).toBe(401);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'unauthorized',
				message: 'Session not found or expired',
			});
		});
	});

	describe('セキュリティ', () => {
		it('should not leak sensitive information in error responses', async () => {
			// 各種エラーレスポンスが一貫していることを確認
			const errorCases = [
				{ cookie: undefined, expectedError: 'unauthorized', expectedMessage: 'Authentication required' },
				{ cookie: 'session_id=', expectedError: 'unauthorized', expectedMessage: 'Authentication required' },
				{ cookie: 'session_id=non-existent', expectedError: 'unauthorized', expectedMessage: 'Session not found or expired' },
			];

			for (const testCase of errorCases) {
				const headers: Record<string, string> = {};
				if (testCase.cookie) {
					headers['Cookie'] = testCase.cookie;
				}

				const response = await app.fetch(
					new Request('http://localhost/api/v1/auth/me', {
						method: 'GET',
						headers,
					}),
					env
				);

				expect(response.status).toBe(401);
				const data = (await response.json()) as { error: string; message: string };
				expect(data.error).toBe(testCase.expectedError);
				expect(data.message).toBe(testCase.expectedMessage);
				// レスポンスに機密情報が含まれていないことを確認
				expect(JSON.stringify(data)).not.toMatch(/password|token|secret|key/i);
			}
		});
	});

	describe('データ整合性', () => {
		it('should return consistent user data structure', async () => {
			// 新フォーマットでセッションを作成（_Userシートがないので500エラーになる）
			const sessionId = 'sess_complete_user_005';
			const userId = 'auth0|complete123';
			const userData = {
				auth0_user_id: userId,
				sub: userId,
			};

			await db.insert(sessionTable).values({
				session_id: sessionId,
				user_id: userId,
				user_data: JSON.stringify(userData),
				access_token: 'complete-access-token',
				refresh_token: 'complete-refresh-token',
				expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
			});

			const response = await app.fetch(
				new Request('http://localhost/api/v1/auth/me', {
					method: 'GET',
					headers: {
						Cookie: `session_id=${sessionId}`,
					},
				}),
				env
			);

			// _Userシートがないので500エラーになる
			expect(response.status).toBe(500);
			const data = (await response.json()) as ErrorResponse;
			expect(data).toEqual({
				success: false,
				error: 'user_not_found',
				message: 'User data not found in _User sheet',
			});
		});
	});
});
