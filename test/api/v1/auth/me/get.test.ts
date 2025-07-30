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
      // 有効なセッションを作成
      const sessionId = 'sess_valid_user_001';
      const userId = 'auth0|user123456789';
      const userData = {
        sub: userId,
        name: '田中太郎',
        email: 'tanaka@example.com',
        picture: 'https://cdn.auth0.com/avatars/ta.png',
        email_verified: true,
        updated_at: '2023-12-01T10:30:00.000Z',
        iss: 'https://your-domain.auth0.com/',
        aud: 'your-client-id',
        iat: 1701424200,
        exp: 1701510600,
        sid: 'session123456789'
      };
      
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: userId,
        user_data: JSON.stringify(userData),
        access_token: 'valid-access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${sessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json() as UserSuccessResponse;
      expect(data).toEqual({
        success: true,
        user: {
          id: userId,
          name: '田中太郎',
          email: 'tanaka@example.com',
          picture: 'https://cdn.auth0.com/avatars/ta.png',
          email_verified: true,
          updated_at: '2023-12-01T10:30:00.000Z',
          iss: 'https://your-domain.auth0.com/',
          aud: 'your-client-id',
          iat: 1701424200,
          exp: 1701510600,
          sub: userId,
          sid: 'session123456789'
        },
        session: {
          session_id: sessionId,
          expires_at: expect.any(String),
          created_at: expect.any(String)
        }
      });
    });

    it('should handle minimal user data correctly', async () => {
      // 最小限のユーザーデータでセッションを作成
      const sessionId = 'sess_minimal_user_002';
      const userId = 'auth0|minimal123';
      const userData = {
        sub: userId,
        email: 'minimal@example.com'
      };
      
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: userId,
        user_data: JSON.stringify(userData),
        access_token: 'minimal-access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${sessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(userId);
      expect(data.user.email).toBe('minimal@example.com');
      expect(data.user.sub).toBe(userId);
    });
  });

  describe('認証エラー', () => {
    it('should return 401 when no session cookie provided', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET'
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    });

    it('should return 401 for non-existent session', async () => {
      const nonExistentSessionId = 'sess_non_existent_999';

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${nonExistentSessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    });

    it('should return 401 and cleanup expired session', async () => {
      // 期限切れセッションを作成
      const expiredSessionId = 'sess_expired_003';
      const userId = 'auth0|expired123';
      const userData = {
        sub: userId,
        email: 'expired@example.com'
      };
      
      await db.insert(sessionTable).values({
        session_id: expiredSessionId,
        user_id: userId,
        user_data: JSON.stringify(userData),
        access_token: 'expired-access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1時間前に期限切れ
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${expiredSessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'session_expired',
        message: 'Session has expired'
      });

      // 期限切れセッションがデータベースから削除されていることを確認
      const remainingSessions = await db.select()
        .from(sessionTable)
        .where(eq(sessionTable.session_id, expiredSessionId));
      expect(remainingSessions).toHaveLength(0);
    });

    it('should return 401 for empty session cookie', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': 'session_id='
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
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
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${invalidSessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(500);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'server_error',
        message: 'Failed to retrieve user information'
      });
    });

    it('should handle database errors gracefully', async () => {
      // 無効なenv（DBが存在しない）でテスト
      const invalidEnv = { ...env, DB: null };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': 'session_id=test-session'
          }
        }),
        invalidEnv
      );

      expect(response.status).toBe(500);
      const data = await response.json() as ErrorResponse;
      expect(data).toEqual({
        success: false,
        error: 'server_error',
        message: 'Failed to retrieve user information'
      });
    });
  });

  describe('セキュリティ', () => {
    it('should implement timing attack mitigation', async () => {
      const startTime = Date.now();

      // 存在しないセッションでリクエスト
      const response1 = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': 'session_id=non-existent-session'
          }
        }),
        env
      );

      const time1 = Date.now() - startTime;
      expect(response1.status).toBe(401);

      // 複数回テストして一定の遅延があることを確認
      const startTime2 = Date.now();
      const response2 = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': 'session_id=another-non-existent'
          }
        }),
        env
      );
      const time2 = Date.now() - startTime2;

      expect(response2.status).toBe(401);
      // 両方とも最低100ms程度の遅延があることを確認
      expect(time1).toBeGreaterThan(90);
      expect(time2).toBeGreaterThan(90);
    });

    it('should not leak sensitive information in error responses', async () => {
      // 各種エラーレスポンスが一貫していることを確認
      const errorCases = [
        { cookie: undefined, expectedError: 'unauthorized' },
        { cookie: 'session_id=', expectedError: 'unauthorized' },
        { cookie: 'session_id=non-existent', expectedError: 'unauthorized' }
      ];

      for (const testCase of errorCases) {
        const headers: Record<string, string> = {};
        if (testCase.cookie) {
          headers['Cookie'] = testCase.cookie;
        }

        const response = await app.fetch(
          new Request('http://localhost/api/v1/auth/me', {
            method: 'GET',
            headers
          }),
          env
        );

        expect(response.status).toBe(401);
        const data = await response.json() as { error: string; message: string };
        expect(data.error).toBe(testCase.expectedError);
        expect(data.message).toBe('Authentication required');
        // レスポンスに機密情報が含まれていないことを確認
        expect(JSON.stringify(data)).not.toMatch(/password|token|secret|key/i);
      }
    });
  });

  describe('データ整合性', () => {
    it('should return consistent user data structure', async () => {
      // 完全なユーザーデータでセッションを作成
      const sessionId = 'sess_complete_user_005';
      const userId = 'auth0|complete123';
      const userData = {
        sub: userId,
        name: '完全太郎',
        email: 'complete@example.com',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
        updated_at: '2023-12-01T10:30:00.000Z',
        iss: 'https://test-domain.auth0.com/',
        aud: 'test-client-id',
        iat: 1701424200,
        exp: 1701510600,
        sid: 'complete-session-123'
      };
      
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: userId,
        user_data: JSON.stringify(userData),
        access_token: 'complete-access-token',
        refresh_token: 'complete-refresh-token',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Cookie': `session_id=${sessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json() as UserSuccessResponse;
      
      // レスポンス構造の確認
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('session');
      
      // ユーザーデータの確認
      const expectedUserFields = ['id', 'name', 'email', 'picture', 'email_verified', 'updated_at', 'iss', 'aud', 'iat', 'exp', 'sub', 'sid'];
      expectedUserFields.forEach(field => {
        expect(data.user).toHaveProperty(field);
      });
      
      // セッションデータの確認
      const expectedSessionFields = ['session_id', 'expires_at', 'created_at'];
      expectedSessionFields.forEach(field => {
        expect(data.session).toHaveProperty(field);
      });
      
      // データの一貫性確認
      expect(data.user.id).toBe(data.user.sub);
      expect(data.user.sub).toBe(userId);
      expect(data.session.session_id).toBe(sessionId);
    });
  });
});