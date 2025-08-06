import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import { auth, requireRoles, getAuth, type AuthContext } from '../../src/middleware/auth';
import { SessionService } from '../../src/services/session';
import { ConfigService } from '../../src/services/config';
import type { Env } from '../../src/types/env';
import { setupConfigDatabase, setupSessionDatabase, setupRefreshTokenDatabase, setupTokenAuditLogDatabase } from '../utils/database-setup';

describe('Authentication Middleware', () => {
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  const db = drizzle(env.DB);

  beforeEach(async () => {
    // Setup database tables
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    await setupRefreshTokenDatabase(db);
    await setupTokenAuditLogDatabase(db);
    
    // Initialize ConfigService
    await ConfigService.initialize(db);
    
    // Add session max age configuration
    await ConfigService.upsert('session_max_age', '2592000', 'number', 'Session maximum age in seconds');
    
    // Initialize SessionService
    SessionService.initialize(db);
    
    // Create new Hono app instance
    app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
  });

  afterEach(async () => {
    // Clean up any sessions created during tests
    // No cleanup needed as each test recreates the table in beforeEach
  });

  describe('auth middleware', () => {
    it('should allow access with valid JWT Bearer token', async () => {
      // Mock Auth0Service.verifyToken to return a valid payload
      const originalAuth0Service = (await import('../../src/services/auth0')).Auth0Service;
      const originalVerifyToken = originalAuth0Service.prototype.verifyToken;
      const mockVerifyToken = async () => ({
        sub: 'auth0|jwt123',
        iss: `https://${env.AUTH0_DOMAIN}/`,
        aud: env.AUTH0_CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 60,
        email: 'user@example.com',
        roles: ['user']
      });
      originalAuth0Service.prototype.verifyToken = mockVerifyToken;

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId,
          roles: authContext.roles
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(true);
      expect(data.userId).toBe('auth0|jwt123');
      expect(data.roles).toEqual(['user']);

      // Restore original method
      originalAuth0Service.prototype.verifyToken = originalVerifyToken;
    });

    it('should reject invalid JWT Bearer token', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid-jwt-token'
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');
      expect(data.message).toBe('Invalid JWT token');
    });

    it('should not fall back to session auth when JWT verification fails', async () => {
      // Ensure Auth0Service is not mocked from previous tests
      const originalAuth0Service = (await import('../../src/services/auth0')).Auth0Service;
      
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        valid: true,
        user_data: { auth0_user_id: 'auth0|session123', sub: 'auth0|session123' }
      });

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId
        });
      });

      // Send both invalid JWT and valid session - should still fail
      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid-jwt-token',
          'Cookie': 'session=valid-session-id'
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');
      expect(data.message).toBe('Invalid JWT token');

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should allow access with valid session cookie', async () => {
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        valid: true,
        user_data: { auth0_user_id: 'auth0|test123', sub: 'auth0|test123' }
      });

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'Cookie': 'session=test-session-id'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(true);
      expect(data.userId).toBe('auth0|test123');

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should deny access with master key when MASTER_KEY is not configured', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          isMasterKey: authContext.isMasterKey
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'x-master-key': 'test-master-key'
        }
      });

      // Since MASTER_KEY is not configured, this should be unauthorized
      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');
    });

    it('should deny access without authentication when required', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected');

      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');
    });

    it('should allow access without authentication when not required', async () => {
      app.use('/public', auth({ required: false }));
      app.get('/public', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated
        });
      });

      const response = await app.request('/public');

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(false);
    });

    it('should reject invalid session cookie', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected', {
        headers: {
          'Cookie': 'session=invalid-session-id'
        }
      });

      expect(response.status).toBe(401);
    });

    it('should reject invalid master key', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected', {
        headers: {
          'x-master-key': 'invalid-key'
        }
      }, {
        MASTER_KEY: 'correct-key'
      });

      expect(response.status).toBe(401);
    });

    it('should work when master key authentication is disabled', async () => {
      app.use('/protected', auth({ allowMasterKey: false }));
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected', {
        headers: {
          'x-master-key': 'test-master-key'
        }
      }, {
        MASTER_KEY: 'test-master-key'
      });

      expect(response.status).toBe(401);
    });
  });

  describe('requireRoles middleware', () => {
    it('should allow access when user has required roles', async () => {
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        valid: true,
        user_data: { auth0_user_id: 'auth0|test123', sub: 'auth0|test123' }
      });

      app.use('/admin', auth());
      
      // Mock the auth context to include admin role before requireRoles check
      app.use('/admin', async (c, next) => {
        const authContext = c.get('auth') as AuthContext;
        if (authContext.isAuthenticated) {
          authContext.roles = ['admin'];
        }
        await next();
      });
      
      app.use('/admin', requireRoles(['admin']));
      app.get('/admin', (c) => c.json({ message: 'admin access granted' }));

      const response = await app.request('/admin', {
        headers: {
          'Cookie': 'session=test-session-id'
        }
      });

      expect(response.status).toBe(200);

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should deny access when user lacks required roles', async () => {
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        valid: true,
        user_data: { auth0_user_id: 'auth0|test123', sub: 'auth0|test123' }
      });

      app.use('/admin', auth());
      
      // Mock the auth context to have no admin role
      app.use('/admin', async (c, next) => {
        const authContext = c.get('auth') as AuthContext;
        if (authContext.isAuthenticated) {
          authContext.roles = ['user']; // Different role, not admin
        }
        await next();
      });
      
      app.use('/admin', requireRoles(['admin']));
      app.get('/admin', (c) => c.json({ message: 'admin access granted' }));

      const response = await app.request('/admin', {
        headers: {
          'Cookie': 'session=test-session-id'
        }
      });

      expect(response.status).toBe(403);
      const data = await response.json() as Record<string, unknown>;
      expect(data.error).toBe('forbidden');

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should deny access with master key when MASTER_KEY is not configured', async () => {
      app.use('/admin', auth());
      app.use('/admin', requireRoles(['admin']));
      app.get('/admin', (c) => c.json({ message: 'admin access granted' }));

      const response = await app.request('/admin', {
        headers: {
          'x-master-key': 'test-master-key'
        }
      });

      // Since MASTER_KEY is not configured, this should be unauthorized
      expect(response.status).toBe(401);
    });

    it('should deny access for unauthenticated users', async () => {
      app.use('/admin', auth());
      app.use('/admin', requireRoles(['admin']));
      app.get('/admin', (c) => c.json({ message: 'admin access granted' }));

      const response = await app.request('/admin');

      expect(response.status).toBe(401);
    });
  });

  describe('getAuth helper', () => {
    it('should return auth context when middleware is mounted', async () => {
      app.use('/test', auth({ required: false }));
      app.get('/test', (c) => {
        const authContext = getAuth(c);
        return c.json({
          isAuthenticated: authContext.isAuthenticated
        });
      });

      const response = await app.request('/test');
      expect(response.status).toBe(200);
    });

    it('should throw error when middleware is not mounted', async () => {
      app.get('/test', (c) => {
        expect(() => getAuth(c)).toThrow('Auth context missing – did you forget to mount auth() middleware?');
        return c.json({ message: 'test' });
      });

      await app.request('/test');
    });
  });

  describe('error handling', () => {
    it('should continue with optional auth when SessionService throws error', async () => {
      app.use('/test', auth({ required: false }));
      app.get('/test', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated
        });
      });

      // Use an invalid session format that might cause SessionService to throw
      const response = await app.request('/test', {
        headers: {
          'Cookie': 'session=malformed-session-data'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(false);
    });

    it('should return 401 when required auth fails due to error', async () => {
      app.use('/test', auth({ required: true }));
      app.get('/test', (c) => c.json({ message: 'success' }));

      // Use an invalid session format that might cause SessionService to throw
      const response = await app.request('/test', {
        headers: {
          'Cookie': 'session=malformed-session-data'
        }
      });

      expect(response.status).toBe(401);
    });
  });

  describe('JWT token auto-refresh', () => {
    beforeEach(async () => {
      // Setup Auth0 configuration for JWT testing
      await ConfigService.upsert('auth0.domain', 'test-domain.auth0.com', 'string', 'Test Auth0 domain');
      await ConfigService.upsert('auth0.client_id', 'test-client-id', 'string', 'Test client ID');
      await ConfigService.upsert('auth0.client_secret', 'test-client-secret', 'string', 'Test client secret');
    });

    it('should attempt token refresh when JWT is expired', async () => {
      // Create a mock session and refresh token
      const sessionResult = await SessionService.createSession({
        auth0_user_id: 'test-user',
        sub: 'test-user'
      });
      expect(sessionResult.success).toBe(true);

      const refreshTokenResult = await SessionService.storeRefreshToken(
        'test-user',
        'test-auth0-refresh-token'
      );
      expect(refreshTokenResult.success).toBe(true);

      // Mock Auth0Service methods
      const originalVerifyToken = (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken;
      const originalRefreshAccessToken = (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken;
      
      let verifyCallCount = 0;
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = async (token: string) => {
        verifyCallCount++;
        if (verifyCallCount === 1) {
          // First call fails with expired token
          throw new Error('Token expired');
        } else {
          // Second call (with refreshed token) succeeds
          return {
            sub: 'test-user',
            iss: 'https://test-domain.auth0.com/',
            aud: 'test-audience',
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            roles: ['user']
          };
        }
      };

      (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken = async () => ({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer' as const,
        scope: 'openid profile email'
      });

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer expired-jwt-token',
          'Cookie': `session=${sessionResult.session_id}; refresh_token_id=${refreshTokenResult.token_id}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(true);
      expect(data.userId).toBe('test-user');

      // Check that new access token is provided in response header
      expect(response.headers.get('X-New-Access-Token')).toBe('new-access-token');

      // Restore original methods
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = originalVerifyToken;
      (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken = originalRefreshAccessToken;
    });

    it('should fail authentication when refresh token is not available', async () => {
      // Mock Auth0Service.verifyToken to return expired token error
      const originalVerifyToken = (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken;
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = async () => {
        throw new Error('Token expired');
      };

      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      // Request with expired JWT but no refresh token
      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer expired-jwt-token'
          // No session or refresh token cookies
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');

      // Restore original method
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = originalVerifyToken;
    });

    it('should fail authentication when token refresh fails', async () => {
      // Create session and refresh token
      const sessionResult = await SessionService.createSession({
        auth0_user_id: 'test-user',
        sub: 'test-user'
      });
      expect(sessionResult.success).toBe(true);

      const refreshTokenResult = await SessionService.storeRefreshToken(
        'test-user',
        'test-auth0-refresh-token'
      );
      expect(refreshTokenResult.success).toBe(true);

      // Mock Auth0Service methods
      const originalVerifyToken = (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken;
      const originalRefreshAccessToken = (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken;
      
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = async () => {
        throw new Error('Token expired');
      };

      // Mock refresh to fail
      (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken = async () => {
        throw new Error('Refresh token invalid');
      };

      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer expired-jwt-token',
          'Cookie': `session=${sessionResult.session_id}; refresh_token_id=${refreshTokenResult.token_id}`
        }
      });

      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');

      // Restore original methods
      (await import('../../src/services/auth0')).Auth0Service.prototype.verifyToken = originalVerifyToken;
      (await import('../../src/services/auth0')).Auth0Service.prototype.refreshAccessToken = originalRefreshAccessToken;
    });

    it('should not fall back to session auth when JWT verification fails', async () => {
      // Ensure Auth0Service is not mocked from previous tests
      const originalAuth0Service = (await import('../../src/services/auth0')).Auth0Service;
      
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        valid: true,
        user_data: { auth0_user_id: 'session-user', sub: 'session-user' }
      });

      // Mock Auth0Service.verifyToken to fail (non-expired error)
      originalAuth0Service.prototype.verifyToken = async () => {
        throw new Error('Invalid token signature'); // Not an expiration error
      };

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer invalid-jwt-token',
          'Cookie': 'session=valid-session-id'
        }
      });

      // Should fail with 401, not fall back to session authentication
      expect(response.status).toBe(401);
      const data = await response.json() as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');

      // Restore original methods
      SessionService.validateSession = originalValidateSession;
    });

    it('should handle JWT verification with valid token normally', async () => {
      // Mock Auth0Service.verifyToken to return valid payload
      const originalAuth0Service = (await import('../../src/services/auth0')).Auth0Service;
      const originalVerifyToken = originalAuth0Service.prototype.verifyToken;
      const mockVerifyToken = async () => ({
        sub: 'auth0|jwt123',
        iss: `https://${env.AUTH0_DOMAIN}/`,
        aud: env.AUTH0_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        roles: ['user']
      });

      originalAuth0Service.prototype.verifyToken = mockVerifyToken;

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth') as AuthContext;
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          userId: authContext.userId,
          roles: authContext.roles
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json() as Record<string, unknown>;
      expect(data.isAuthenticated).toBe(true);
      expect(data.userId).toBe('auth0|jwt123');
      expect(data.roles).toEqual(['user']);

      // Restore original method
      originalAuth0Service.prototype.verifyToken = originalVerifyToken;
    });
  });
});