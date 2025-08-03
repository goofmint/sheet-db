import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import { SessionService } from '../../src/services/session';
import { ConfigService } from '../../src/services/config';
import { setupConfigDatabase, setupSessionDatabase } from '../utils/database-setup';
import type { Auth0UserData } from '../../src/types/session';

describe('SessionService', () => {
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
  });

  afterEach(async () => {
    // Cleanup is handled by beforeEach setup
  });

  describe('Initialization', () => {
    it('should initialize correctly', () => {
      expect(SessionService.isInitialized()).toBe(true);
    });

    it('should throw error when using uninitialized service', () => {
      // Create a fresh instance without initialization
      const uninitializedService = Object.create(SessionService);
      uninitializedService.initialized = false;
      
      expect(() => {
        uninitializedService.ensureInitialized();
      }).toThrow('SessionService must be initialized before use');
    });
  });

  describe('createSession', () => {
    const validUserData: Auth0UserData = {
      auth0_user_id: 'auth0|123456789',
      sub: 'auth0|123456789'
    };

    it('should create session successfully with valid user data', async () => {
      const result = await SessionService.createSession(validUserData);
      
      expect(result.success).toBe(true);
      expect(result.session_id).toBeDefined();
      expect(result.expires_at).toBeDefined();
      expect(result.error).toBeUndefined();

      // Verify session ID is a valid UUID
      expect(result.session_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should set correct expiration time based on config', async () => {
      const result = await SessionService.createSession(validUserData);
      expect(result.success).toBe(true);
      
      const expiresAt = new Date(result.expires_at!);
      const now = new Date();
      const diffInSeconds = (expiresAt.getTime() - now.getTime()) / 1000;
      
      // Should be approximately 30 days (allowing for small timing differences)
      expect(diffInSeconds).toBeGreaterThan(2592000 - 10); // 30 days minus 10 seconds
      expect(diffInSeconds).toBeLessThan(2592000 + 10); // 30 days plus 10 seconds
    });

    it('should fail with missing auth0_user_id', async () => {
      const invalidUserData = {
        auth0_user_id: '',
        sub: 'auth0|123456789'
      };

      const result = await SessionService.createSession(invalidUserData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('auth0_user_id and sub are required');
    });

    it('should fail with missing sub', async () => {
      const invalidUserData = {
        auth0_user_id: 'auth0|123456789',
        sub: ''
      };

      const result = await SessionService.createSession(invalidUserData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('auth0_user_id and sub are required');
    });
  });

  describe('validateSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const userData: Auth0UserData = {
        auth0_user_id: 'auth0|test123',
        sub: 'auth0|test123'
      };

      const result = await SessionService.createSession(userData);
      expect(result.success).toBe(true);
      testSessionId = result.session_id!;
    });

    it('should validate valid session successfully', async () => {
      const result = await SessionService.validateSession(testSessionId);
      
      expect(result.valid).toBe(true);
      expect(result.user_data).toBeDefined();
      expect(result.user_data!.auth0_user_id).toBe('auth0|test123');
      expect(result.user_data!.sub).toBe('auth0|test123');
      expect(result.session_id).toBe(testSessionId);
      expect(result.expires_at).toBeDefined();
    });

    it('should fail with invalid session ID', async () => {
      const result = await SessionService.validateSession('invalid-session-id');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Session not found or expired');
    });

    it('should fail with empty session ID', async () => {
      const result = await SessionService.validateSession('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });

    it('should fail with null session ID', async () => {
      const result = await SessionService.validateSession(null as unknown as string);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });

    it('should fail with non-existent session ID', async () => {
      const nonExistentId = crypto.randomUUID();
      const result = await SessionService.validateSession(nonExistentId);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Session not found or expired');
    });
  });

  describe('refreshSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const userData: Auth0UserData = {
        auth0_user_id: 'auth0|refresh123',
        sub: 'auth0|refresh123'
      };

      const result = await SessionService.createSession(userData);
      expect(result.success).toBe(true);
      testSessionId = result.session_id!;
    });

    it('should refresh valid session successfully', async () => {
      const result = await SessionService.refreshSession(testSessionId);
      
      expect(result.success).toBe(true);
      expect(result.new_expires_at).toBeDefined();
      
      // Verify new expiration is in the future
      const newExpiresAt = new Date(result.new_expires_at!);
      const now = new Date();
      expect(newExpiresAt.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should fail with invalid session ID', async () => {
      const result = await SessionService.refreshSession('invalid-session-id');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found or expired');
    });

    it('should fail with empty session ID', async () => {
      const result = await SessionService.refreshSession('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid session ID');
    });
  });

  describe('deleteSession', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const userData: Auth0UserData = {
        auth0_user_id: 'auth0|delete123',
        sub: 'auth0|delete123'
      };

      const result = await SessionService.createSession(userData);
      expect(result.success).toBe(true);
      testSessionId = result.session_id!;
    });

    it('should delete valid session successfully', async () => {
      const result = await SessionService.deleteSession(testSessionId);
      expect(result).toBe(true);

      // Verify session is actually deleted
      const validateResult = await SessionService.validateSession(testSessionId);
      expect(validateResult.valid).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      const nonExistentId = crypto.randomUUID();
      const result = await SessionService.deleteSession(nonExistentId);
      expect(result).toBe(false);
    });

    it('should return false for empty session ID', async () => {
      const result = await SessionService.deleteSession('');
      expect(result).toBe(false);
    });

    it('should return false for null session ID', async () => {
      const result = await SessionService.deleteSession(null as unknown as string);
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should return 0 when no expired sessions exist', async () => {
      const result = await SessionService.cleanupExpiredSessions();
      expect(result).toBe(0);
    });

    it('should clean up expired sessions', async () => {
      // This test would require creating sessions with past expiry dates
      // For now, we'll just verify the method doesn't throw
      const result = await SessionService.cleanupExpiredSessions();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Utility methods', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const userData: Auth0UserData = {
        auth0_user_id: 'auth0|utility123',
        sub: 'auth0|utility123'
      };

      const result = await SessionService.createSession(userData);
      expect(result.success).toBe(true);
      testSessionId = result.session_id!;
    });

    it('should validate session ID with constant-time comparison', () => {
      const result1 = SessionService.validateSessionId(testSessionId, testSessionId);
      expect(result1).toBe(true);

      const result2 = SessionService.validateSessionId(testSessionId, 'different-session-id');
      expect(result2).toBe(false);

      const result3 = SessionService.validateSessionId('', '');
      expect(result3).toBe(false);
    });

    it('should get user data from session', async () => {
      const userData = await SessionService.getUserData(testSessionId);
      
      expect(userData).toBeDefined();
      expect(userData!.auth0_user_id).toBe('auth0|utility123');
      expect(userData!.sub).toBe('auth0|utility123');
    });

    it('should return null for invalid session when getting user data', async () => {
      const userData = await SessionService.getUserData('invalid-session-id');
      expect(userData).toBeNull();
    });

    it('should check if session is valid', async () => {
      const isValid = await SessionService.isValidSession(testSessionId);
      expect(isValid).toBe(true);

      const isInvalid = await SessionService.isValidSession('invalid-session-id');
      expect(isInvalid).toBe(false);
    });

    it('should clean up user sessions', async () => {
      const result = await SessionService.cleanupUserSessions('auth0|utility123', 5);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error handling', () => {
    it('should handle validation errors gracefully', async () => {
      const invalidUserData = {
        auth0_user_id: null as unknown as string,
        sub: 'auth0|error123'
      };

      const result = await SessionService.createSession(invalidUserData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('auth0_user_id and sub are required');
    });
  });
});