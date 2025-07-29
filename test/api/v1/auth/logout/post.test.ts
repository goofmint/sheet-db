import { describe, it, expect, beforeEach } from 'vitest';
import app from '@/index';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { sessionTable } from '@/db/schema';
import { env } from 'cloudflare:test';
import { setupSessionDatabase, setupConfigDatabase } from '../../../../utils/database-setup';
import { ConfigService } from '@/services/config';

describe('Logout API - POST /api/v1/auth/logout', () => {
  const db = drizzle(env.DB);

  beforeEach(async () => {
    // データベーステーブルを再作成
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    
    // ConfigServiceを初期化
    await ConfigService.initialize(db);
  });

  describe('CSRF Protection', () => {
    it('should reject requests without X-Requested-With header', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_test_session_123';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-123',
        user_data: JSON.stringify({ sub: 'test-user-123', email: 'test@example.com' }),
        access_token: 'test-access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`
          }
        }),
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'invalid_request',
        message: 'Invalid request headers'
      });
    });

    it('should reject requests with invalid Origin header', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_test_session_456';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-456',
        user_data: JSON.stringify({ sub: 'test-user-456', email: 'test2@example.com' }),
        access_token: 'test-access-token-2',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'https://malicious-site.com'
          }
        }),
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'invalid_origin',
        message: 'Invalid request origin'
      });
    });

    it('should reject requests without Origin or Referer headers', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_no_headers_test';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-no-headers',
        user_data: JSON.stringify({ sub: 'test-user-no-headers', email: 'no-headers@example.com' }),
        access_token: 'test-access-token-no-headers',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest'
            // OriginもRefererも含めない
          }
        }),
        env
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'missing_origin_headers',
        message: 'Origin or Referer header is required'
      });
    });

    it('should accept requests with valid CSRF headers', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_test_session_789';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-789',
        user_data: JSON.stringify({ sub: 'test-user-789', email: 'test3@example.com' }),
        access_token: 'test-access-token-3',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Successfully logged out'
      });
    });

    it('should accept requests with valid Referer header', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_test_referer_456';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-referer',
        user_data: JSON.stringify({ sub: 'test-user-referer', email: 'referer@example.com' }),
        access_token: 'test-access-token-referer',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'http://localhost/some-page'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Successfully logged out'
      });
    });
  });

  describe('Session Management', () => {
    it('should successfully logout with valid session', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_valid_session_001';
      const userId = 'user-123';
      
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: userId,
        user_data: JSON.stringify({ sub: userId, email: 'user@example.com' }),
        access_token: 'valid-access-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Successfully logged out'
      });

      // セッションがデータベースから削除されていることを確認
      const remainingSessions = await db.select()
        .from(sessionTable)
        .where(eq(sessionTable.session_id, sessionId));
      expect(remainingSessions).toHaveLength(0);

      // Cookie削除の確認
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('session_id=');
      expect(setCookieHeader).toContain('Max-Age=0');
      expect(setCookieHeader).toContain('SameSite=Strict');
    });

    it('should return 401 for requests without session cookie', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'unauthorized',
        message: 'No active session found'
      });
    });

    it('should handle non-existent session gracefully', async () => {
      const nonExistentSessionId = 'sess_non_existent_999';

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${nonExistentSessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Successfully logged out'
      });
    });
  });

  describe('Request Handling', () => {
    it('should handle empty request body correctly', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_empty_body_test';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-user-empty',
        user_data: JSON.stringify({ sub: 'test-user-empty', email: 'empty@example.com' }),
        access_token: 'test-access-token-empty',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        success: true,
        message: 'Successfully logged out'
      });
    });

    it('should include proper security headers in response', async () => {
      // 有効なセッションを作成
      const sessionId = 'sess_security_headers_test';
      await db.insert(sessionTable).values({
        session_id: sessionId,
        user_id: 'test-security-user',
        user_data: JSON.stringify({ sub: 'test-security-user', email: 'security@example.com' }),
        access_token: 'test-security-token',
        refresh_token: null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_id=${sessionId}`,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        env
      );

      expect(response.status).toBe(200);

      // Cookie削除の詳細な確認
      const setCookieHeader = response.headers.get('Set-Cookie');
      expect(setCookieHeader).toContain('session_id=');
      expect(setCookieHeader).toContain('HttpOnly');
      expect(setCookieHeader).toContain('SameSite=Strict');
      expect(setCookieHeader).toContain('Path=/');
      expect(setCookieHeader).toContain('Max-Age=0');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // 無効なenv（DBが存在しない）でテスト
      const invalidEnv = { ...env, DB: null };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'session_id=test-session',
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://localhost'
          }
        }),
        invalidEnv
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({
        success: false,
        error: 'logout_failed',
        message: 'Logout process failed'
      });
    });
  });
});