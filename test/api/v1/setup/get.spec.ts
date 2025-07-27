import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../../../src/index';
import { ConfigService } from '../../../../src/services/config';
import { configTable } from '../../../../src/db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { setupTestDatabase } from '../../../utils/database-setup';

describe('Setup API - GET /api/v1/setup', () => {
  let db: DrizzleD1Database;

  beforeAll(async () => {
    // Get real D1 database from cloudflare:test environment
    db = drizzle(env.DB);
    
    // Setup test database with all tables
    await setupTestDatabase(db);
    
    // Initialize ConfigService with real database
    await ConfigService.initialize(db);
  });

  beforeEach(async () => {
    // Clear all config data before each test
    await db.delete(configTable);
    await ConfigService.refreshCache();
  });

  describe('Setup incomplete scenarios', () => {
    it('should return setup status when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.setup.isCompleted).toBe(false);
      expect(data.setup.requiredFields).toBeInstanceOf(Array);
      expect(data.setup.completedFields).toBeInstanceOf(Array);
      expect(data.setup.currentConfig).toBeDefined();
      expect(data.setup.progress).toBeDefined();
      expect(data.setup.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should include actual config values when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      const data = await response.json() as any;
      
      // セットアップ未完了時は実際の設定値が含まれる
      expect(data.setup.currentConfig.google).toBeDefined();
      expect(data.setup.currentConfig.auth0).toBeDefined();
      
      // フラグ形式ではない
      expect(data.setup.currentConfig.hasGoogleCredentials).toBeUndefined();
      expect(data.setup.currentConfig.hasAuth0Config).toBeUndefined();
    });

    it('should calculate progress correctly', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      const data = await response.json() as any;
      const { progress } = data.setup;
      
      expect(progress.completedSteps).toBe(0); // 初期状態では0
      expect(progress.totalSteps).toBeGreaterThan(0);
      expect(progress.percentage).toBe(0);
    });

    it('should provide next steps when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      const data = await response.json() as any;
      
      expect(data.setup.nextSteps).toBeInstanceOf(Array);
      expect(data.setup.nextSteps.length).toBeGreaterThan(0);
      expect(data.setup.nextSteps[0]).toContain('Google');
    });
  });

  describe('Setup completed without authentication', () => {
    beforeEach(async () => {
      // Set up completed state in real database
      await db.insert(configTable).values([
        {
          key: 'app.setup_completed',
          value: 'true',
          type: 'string',
          description: 'Setup completion status'
        },
        {
          key: 'app.config_password',
          value: 'test-secret',
          type: 'string',
          description: 'Config password'
        }
      ]);
      await ConfigService.refreshCache();
    });

    it('should require authentication when setup is completed', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(data.error.message).toContain('Authorization header');
    });
  });

  describe('Setup completed with authentication', () => {
    beforeEach(async () => {
      // Set up completed state with known password in real database
      await db.insert(configTable).values([
        {
          key: 'app.setup_completed',
          value: 'true',
          type: 'string',
          description: 'Setup completion status'
        },
        {
          key: 'app.config_password',
          value: 'test-secret',
          type: 'string',
          description: 'Config password'
        }
      ]);
      await ConfigService.refreshCache();
    });

    it('should accept valid Bearer token', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-secret'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.setup.isCompleted).toBe(true);
    });

    it('should reject invalid Bearer token', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Authorization': 'Bearer wrong-password'
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should handle malformed Authorization header', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Authorization': 'InvalidFormat'
          }
        }),
        env
      );

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });


  describe('Response structure validation', () => {
    it('should have correct response structure', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        env
      );

      const data = await response.json() as any;
      
      // Check top-level structure
      expect(data).toHaveProperty('setup');
      expect(data).toHaveProperty('timestamp');
      
      // Check setup object structure
      const { setup } = data;
      expect(setup).toHaveProperty('isCompleted');
      expect(setup).toHaveProperty('requiredFields');
      expect(setup).toHaveProperty('completedFields');
      expect(setup).toHaveProperty('currentConfig');
      expect(setup).toHaveProperty('nextSteps');
      expect(setup).toHaveProperty('progress');
      
      // Check progress structure
      expect(setup.progress).toHaveProperty('percentage');
      expect(setup.progress).toHaveProperty('completedSteps');
      expect(setup.progress).toHaveProperty('totalSteps');
      
      // Check data types
      expect(typeof setup.isCompleted).toBe('boolean');
      expect(Array.isArray(setup.requiredFields)).toBe(true);
      expect(Array.isArray(setup.completedFields)).toBe(true);
      expect(Array.isArray(setup.nextSteps)).toBe(true);
      expect(typeof setup.progress.percentage).toBe('number');
    });

    it('should include CORS headers for cross-origin requests', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Origin': 'https://example.com'
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});