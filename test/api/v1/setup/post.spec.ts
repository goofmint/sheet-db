import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../../../src/index';
import { ConfigService } from '../../../../src/services/config';
import { configTable, cacheTable, sessionTable } from '../../../../src/db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type { SetupSuccessResponse, SetupErrorResponse } from '../../../../src/api/v1/setup/types';
import { setupTestDatabase } from '../../../utils/database-setup';

describe('Setup API - POST /api/v1/setup', () => {
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
    // Clear all data from all tables to ensure full test isolation
    await db.delete(configTable);
    await db.delete(cacheTable);
    await db.delete(sessionTable);
    await ConfigService.refreshCache();
  });

  const validSetupData = {
    google: {
      clientId: "123456789-abcdefghijklmnop.apps.googleusercontent.com",
      clientSecret: "GOCSPX-abcdefghijklmnopqrstuvwxyz"
    },
    auth0: {
      domain: "test-domain.auth0.com",
      clientId: "abcdefghijklmnopqrstuvwxyz123456",
      clientSecret: "abcdefghijklmnopqrstuvwxyz123456789abcdefghijklmn"
    },
    app: {
      configPassword: "SecurePass123!"
    }
  };

  describe('Initial Setup (Setup not completed)', () => {
    it('should complete initial setup with valid configuration', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as SetupSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.message).toContain('Initial setup completed');
      expect(data.setup.isCompleted).toBe(true);
      expect(data.setup.completedAt).toBeDefined();
      expect(data.setup.configuredServices).toContain('google');
      expect(data.setup.configuredServices).toContain('auth0');
      expect(data.timestamp).toBeDefined();

      // Verify configuration was saved
      expect(ConfigService.getString('google.client_id')).toBe(validSetupData.google.clientId);
      expect(ConfigService.getString('auth0.domain')).toBe(validSetupData.auth0.domain);
      expect(ConfigService.getBoolean('app.setup_completed')).toBe(true);
    });

    it('should complete setup without optional database field', async () => {
      const setupDataWithoutDb = {
        google: validSetupData.google,
        auth0: validSetupData.auth0,
        app: validSetupData.app
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(setupDataWithoutDb)
        }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as SetupSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.setup.configuredServices).toContain('google');
      expect(data.setup.configuredServices).toContain('auth0');
      expect(data.setup.configuredServices).not.toContain('database');
    });
  });

  describe('Re-setup (Setup already completed)', () => {
    beforeEach(async () => {
      // Set up completed state in real database
      await db.insert(configTable).values([
        {
          key: 'app.setup_completed',
          value: 'true',
          type: 'boolean',
          description: 'Setup completion status'
        },
        {
          key: 'app.config_password',
          value: 'existing-password',
          type: 'string',
          description: 'Config password'
        }
      ]);
      await ConfigService.refreshCache();
    });

    it('should allow re-setup with valid authentication', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer existing-password'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as SetupSuccessResponse;
      expect(data.success).toBe(true);
      expect(data.message).toContain('updated successfully');
    });

    it('should require authentication when setup already completed', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      expect(response.status).toBe(401);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
      expect(data.error.message).toContain('Authorization header');
    });

    it('should reject invalid Bearer token', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer wrong-password'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      expect(response.status).toBe(401);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Validation Errors', () => {
    it('should reject invalid JSON', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: 'invalid json{'
        }),
        env
      );

      expect(response.status).toBe(400);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('INVALID_JSON');
    });

    it('should reject missing required fields', async () => {
      const incompleteData = {
        google: validSetupData.google
        // Missing auth0 and app
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(incompleteData)
        }),
        env
      );

      expect(response.status).toBe(400);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid Google Client ID format', async () => {
      const invalidData = {
        ...validSetupData,
        google: {
          ...validSetupData.google,
          clientId: "invalid-client-id"
        }
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        }),
        env
      );

      expect(response.status).toBe(400);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid Auth0 domain format', async () => {
      const invalidData = {
        ...validSetupData,
        auth0: {
          ...validSetupData.auth0,
          domain: "invalid-domain.com"
        }
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        }),
        env
      );

      expect(response.status).toBe(400);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject weak passwords', async () => {
      const invalidData = {
        ...validSetupData,
        app: {
          configPassword: "weak"
        }
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(invalidData)
        }),
        env
      );

      expect(response.status).toBe(400);
      
      const data = await response.json() as SetupErrorResponse;
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

  });


  describe('Response Structure Validation', () => {
    it('should have correct success response structure', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      const data = await response.json() as SetupSuccessResponse;
      
      // Check top-level structure
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('setup');
      expect(data).toHaveProperty('timestamp');
      
      // Check setup object structure
      const { setup } = data;
      expect(setup).toHaveProperty('isCompleted');
      expect(setup).toHaveProperty('completedAt');
      expect(setup).toHaveProperty('configuredServices');
      
      // Check data types
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.message).toBe('string');
      expect(typeof setup.isCompleted).toBe('boolean');
      expect(typeof setup.completedAt).toBe('string');
      expect(Array.isArray(setup.configuredServices)).toBe(true);
      expect(typeof data.timestamp).toBe('string');
    });

    it('should include CORS headers for cross-origin requests', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://example.com'
          },
          body: JSON.stringify(validSetupData)
        }),
        env
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});