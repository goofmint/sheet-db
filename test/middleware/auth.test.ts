import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import { auth, requireRoles, getAuth } from '../../src/middleware/auth';
import { SessionService } from '../../src/services/session';
import { ConfigService } from '../../src/services/config';
import type { Env } from '../../src/types/env';
import { setupConfigDatabase, setupSessionDatabase } from '../utils/database-setup';

describe('Authentication Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  const db = drizzle(env.DB);

  beforeEach(async () => {
    // Setup database tables
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    
    // Initialize ConfigService
    await ConfigService.initialize(db);
    
    // Add session max age configuration
    await ConfigService.upsert('session_max_age', '2592000', 'number', 'Session maximum age in seconds');
    
    // Initialize SessionService
    SessionService.initialize(db);
    
    // Create new Hono app instance
    app = new Hono<{ Bindings: Env }>();
  });

  afterEach(async () => {
    // Clean up any sessions created during tests
    try {
      await SessionService.cleanupExpiredSessions();
    } catch (error) {
      // Ignore cleanup errors - table might not exist in some tests
    }
  });

  describe('auth middleware', () => {
    it('should allow access with valid session cookie', async () => {
      // Mock SessionService.validateSession to return success
      const originalValidateSession = SessionService.validateSession;
      SessionService.validateSession = async () => ({
        success: true,
        auth0UserId: 'auth0|test123'
      });

      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth');
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
      const data = await response.json();
      expect(data.isAuthenticated).toBe(true);
      expect(data.userId).toBe('auth0|test123');

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should allow access with valid master key', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => {
        const authContext = c.get('auth');
        return c.json({
          isAuthenticated: authContext.isAuthenticated,
          isMasterKey: authContext.isMasterKey
        });
      });

      const response = await app.request('/protected', {
        headers: {
          'x-master-key': 'test-master-key'
        }
      }, {
        MASTER_KEY: 'test-master-key'
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isAuthenticated).toBe(true);
      expect(data.isMasterKey).toBe(true);
    });

    it('should deny access without authentication when required', async () => {
      app.use('/protected', auth());
      app.get('/protected', (c) => c.json({ message: 'success' }));

      const response = await app.request('/protected');

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('unauthorized');
    });

    it('should allow access without authentication when not required', async () => {
      app.use('/public', auth({ required: false }));
      app.get('/public', (c) => {
        const authContext = c.get('auth');
        return c.json({
          isAuthenticated: authContext.isAuthenticated
        });
      });

      const response = await app.request('/public');

      expect(response.status).toBe(200);
      const data = await response.json();
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
        success: true,
        auth0UserId: 'auth0|test123'
      });

      app.use('/admin', auth());
      
      // Mock the auth context to include admin role before requireRoles check
      app.use('/admin', async (c, next) => {
        const authContext = c.get('auth');
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
        success: true,
        auth0UserId: 'auth0|test123'
      });

      app.use('/admin', auth());
      
      // Mock the auth context to have no admin role
      app.use('/admin', async (c, next) => {
        const authContext = c.get('auth');
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
      const data = await response.json();
      expect(data.error).toBe('forbidden');

      // Restore original method
      SessionService.validateSession = originalValidateSession;
    });

    it('should allow master key to bypass role checks', async () => {
      app.use('/admin', auth());
      app.use('/admin', requireRoles(['admin']));
      app.get('/admin', (c) => c.json({ message: 'admin access granted' }));

      const response = await app.request('/admin', {
        headers: {
          'x-master-key': 'test-master-key'
        }
      }, {
        MASTER_KEY: 'test-master-key'
      });

      expect(response.status).toBe(200);
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
        const authContext = c.get('auth');
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
      const data = await response.json();
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
});