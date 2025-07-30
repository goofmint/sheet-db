import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { Config as ConfigTable } from '@/db/schema';
import { ConfigService } from '@/services/config';
import { createSessionToken, generateCSRFToken } from '@/utils/security';
import { validateConfigUpdate, validateField, getFieldMetadata } from '@/repositories/config-validation';
import app from '@/index';

// Test environment setup
const testEnv = {
  DB: {} as D1Database,
  QUEUE: {} as Queue,
  KV: {} as KVNamespace,
  R2: {} as R2Bucket,
  CACHE: {} as CacheStorage
};

describe('Config Edit Functionality', () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    // Initialize test database
    db = drizzle(testEnv.DB) as any;
    
    // Initialize ConfigService with test data
    await ConfigService.initialize(db as any);
    
    // Set up test configuration
    const testConfigs = [
      { key: 'google.client_id', value: 'test-google-client-id', type: 'string' as const },
      { key: 'google.client_secret', value: 'test-google-secret', type: 'string' as const },
      { key: 'auth0.domain', value: 'test.auth0.com', type: 'string' as const },
      { key: 'auth0.client_id', value: 'test-auth0-client-id', type: 'string' as const },
      { key: 'auth0.client_secret', value: 'test-auth0-secret', type: 'string' as const },
      { key: 'app.config_password', value: 'testpassword123', type: 'string' as const },
      { key: 'app.setup_completed', value: 'true', type: 'boolean' as const },
      { key: 'storage.type', value: 'r2', type: 'string' as const },
      { key: 'storage.r2.accountId', value: 'test-account', type: 'string' as const },
      { key: 'storage.r2.accessKeyId', value: 'test-access-key', type: 'string' as const },
      { key: 'storage.r2.secretAccessKey', value: 'test-secret-key', type: 'string' as const },
      { key: 'storage.r2.bucketName', value: 'test-bucket', type: 'string' as const },
      { key: 'storage.r2.endpoint', value: 'https://test.r2.cloudflarestorage.com', type: 'string' as const },
    ];

    await db.insert(ConfigTable).values(testConfigs).execute();
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(ConfigTable).execute();
  });

  describe('Config Validation', () => {
    it('should validate complete configuration object', () => {
      const validConfig = {
        google: {
          client_id: 'test-client-id',
          client_secret: 'test-secret',
        },
        auth0: {
          domain: 'test.auth0.com',
          client_id: 'test-client-id',
          client_secret: 'test-secret',
        },
        storage: {
          type: 'r2' as const,
          r2: {
            accountId: 'test-account',
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
            bucketName: 'test-bucket',
            endpoint: 'https://test.r2.cloudflarestorage.com',
          },
        },
        app: {
          config_password: 'testpassword123',
          setup_completed: true,
        },
        csrf_token: 'test-csrf-token',
      };

      const result = validateConfigUpdate(validConfig);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation with invalid data', () => {
      const invalidConfig = {
        google: {
          client_id: '', // Empty required field
          client_secret: 'test-secret',
        },
        auth0: {
          domain: 'invalid-domain', // Invalid domain format
          client_id: 'test-client-id',
          client_secret: 'test-secret',
        },
        storage: {
          type: 'r2' as const,
          // Missing required r2 config
        },
        app: {
          config_password: 'short', // Too short password
          setup_completed: true,
        },
        csrf_token: 'test-csrf-token',
      };

      const result = validateConfigUpdate(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate individual fields', () => {
      // Valid cases
      expect(validateField('google.client_id', 'test.apps.googleusercontent.com')).toEqual({ valid: true });
      expect(validateField('auth0.domain', 'test.auth0.com')).toEqual({ valid: true });
      expect(validateField('app.config_password', 'longpassword123')).toEqual({ valid: true });
      expect(validateField('storage.r2.endpoint', 'https://test.r2.cloudflarestorage.com')).toEqual({ valid: true });

      // Invalid cases
      const shortPasswordResult = validateField('app.config_password', 'short');
      expect(shortPasswordResult.valid).toBe(false);
      expect(shortPasswordResult.error).toContain('at least 8 characters');

      const invalidUrlResult = validateField('storage.r2.endpoint', 'not-a-url');
      expect(invalidUrlResult.valid).toBe(false);
      expect(invalidUrlResult.error).toContain('Invalid');
    });

    it('should get correct field metadata', () => {
      const secretField = getFieldMetadata('google.client_secret');
      expect(secretField.type).toBe('password');
      expect(secretField.sensitive).toBe(true);

      const normalField = getFieldMetadata('google.client_id');
      expect(normalField.type).toBe('text');
      expect(normalField.sensitive).toBe(false);

      const booleanField = getFieldMetadata('app.setup_completed');
      expect(booleanField.type).toBe('boolean');
      expect(booleanField.sensitive).toBe(false);

      const urlField = getFieldMetadata('storage.r2.endpoint');
      expect(urlField.type).toBe('url');
      expect(urlField.sensitive).toBe(false);
    });
  });

  describe('Config Page Access', () => {
    it('should show login form when not authenticated', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        testEnv
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Configuration Management');
      expect(html).toContain('password');
      expect(html).toContain('Login');
    });

    it('should authenticate with correct password', async () => {
      const csrfToken = generateCSRFToken();
      
      const formData = new FormData();
      formData.append('password', 'testpassword123');
      formData.append('csrf_token', csrfToken);

      const response = await app.fetch(
        new Request('http://localhost/config/auth', {
          method: 'POST',
          body: formData,
          headers: {
            'Cookie': `csrf_token=${csrfToken}`,
          },
        }),
        testEnv
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      expect(response.headers.get('Set-Cookie')).toContain('session_token');
    });

    it('should reject invalid password', async () => {
      const csrfToken = generateCSRFToken();
      
      const formData = new FormData();
      formData.append('password', 'wrongpassword');
      formData.append('csrf_token', csrfToken);

      const response = await app.fetch(
        new Request('http://localhost/config/auth', {
          method: 'POST',
          body: formData,
          headers: {
            'Cookie': `csrf_token=${csrfToken}`,
          },
        }),
        testEnv
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=invalid_password');
    });
  });

  describe('Config Edit Interface', () => {
    it('should display editable config form when authenticated', async () => {
      const sessionToken = createSessionToken('testpassword123');
      const csrfToken = generateCSRFToken();

      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
          headers: {
            'Cookie': `session_token=${sessionToken}; csrf_token=${csrfToken}`,
          },
        }),
        testEnv
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for editable form elements
      expect(html).toContain('Save All');
      expect(html).toContain('Reset All');
      expect(html).toContain('data-original=');
      expect(html).toContain('type="password"');
      expect(html).toContain('Validate');
      
      // Check for config values
      expect(html).toContain('google.client_id');
      expect(html).toContain('auth0.domain');
      expect(html).toContain('app.config_password');
    });

    it('should serve CSS file', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config/styles.css', {
          method: 'GET',
        }),
        testEnv
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/css');
      const css = await response.text();
      expect(css).toContain('.config-table');
      expect(css).toContain('.btn-primary');
    });

    it('should serve JavaScript file', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config/client.js', {
          method: 'GET',
        }),
        testEnv
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/javascript');
      const js = await response.text();
      expect(js).toContain('updateChangesCount');
      expect(js).toContain('validateField');
      expect(js).toContain('submitForm');
    });
  });

  describe('Config Update via API', () => {
    it('should update configuration via POST /api/v1/setup', async () => {
      const sessionToken = createSessionToken('testpassword123');
      const csrfToken = generateCSRFToken();

      const updateData = {
        google: {
          client_id: 'updated-google-client-id',
          client_secret: 'updated-google-secret',
        },
        auth0: {
          domain: 'updated.auth0.com',
          client_id: 'updated-auth0-client-id',
          client_secret: 'updated-auth0-secret',
        },
        storage: {
          type: 'r2',
          r2: {
            accountId: 'updated-account',
            accessKeyId: 'updated-access-key',
            secretAccessKey: 'updated-secret-key',
            bucketName: 'updated-bucket',
            endpoint: 'https://updated.r2.cloudflarestorage.com',
          },
        },
        app: {
          config_password: 'updatedpassword123',
          setup_completed: true,
        },
        csrf_token: csrfToken,
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_token=${sessionToken}; csrf_token=${csrfToken}`,
          },
          body: JSON.stringify(updateData),
        }),
        testEnv
      );

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message?: string };
      expect(result.success).toBe(true);

      // Verify configs were updated
      expect(ConfigService.getString('google.client_id')).toBe('updated-google-client-id');
      expect(ConfigService.getString('auth0.domain')).toBe('updated.auth0.com');
    });

    it('should reject update with invalid CSRF token', async () => {
      const sessionToken = createSessionToken('testpassword123');
      const validCsrfToken = generateCSRFToken();
      const invalidCsrfToken = 'invalid-csrf-token';

      const updateData = {
        google: { client_id: 'test', client_secret: 'test' },
        auth0: { domain: 'test.auth0.com', client_id: 'test', client_secret: 'test' },
        storage: { type: 'r2', r2: {} },
        app: { config_password: 'testpassword', setup_completed: true },
        csrf_token: invalidCsrfToken,
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': `session_token=${sessionToken}; csrf_token=${validCsrfToken}`,
          },
          body: JSON.stringify(updateData),
        }),
        testEnv
      );

      expect(response.status).toBe(403);
      const result = await response.json() as { error: string };
      expect(result.error).toContain('CSRF');
    });
  });

  describe('Logout Functionality', () => {
    it('should logout and clear session', async () => {
      const sessionToken = createSessionToken('testpassword123');
      const csrfToken = generateCSRFToken();

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);

      const response = await app.fetch(
        new Request('http://localhost/config/logout', {
          method: 'POST',
          body: formData,
          headers: {
            'Cookie': `session_token=${sessionToken}; csrf_token=${csrfToken}`,
          },
        }),
        testEnv
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      // Check that session cookie is cleared
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('session_token=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });
});