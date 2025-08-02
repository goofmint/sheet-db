import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import app from '@/index';
import { ConfigService } from '@/services/config';
import { setupConfigDatabase, setupSessionDatabase } from '../../../utils/database-setup';
import { SessionRepository } from '@/repositories/session';
import { createTestSession } from '../../../utils/auth-utils';

type ConfigResponse = {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  data?: {
    id: string;
    key: string;
    value: string | number | boolean | object;
    type: string;
    description: string | null;
    system_config: boolean;
    validation: object | null;
    created_at: string;
    updated_at: string;
  };
};

describe('POST /api/v1/configs', () => {
  const baseUrl = 'http://localhost';
  const db = drizzle(env.DB);
  const sessionRepo = new SessionRepository(db);
  let validSessionId: string;

  beforeEach(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    await ConfigService.initialize(db);
    
    // Create test session for authentication
    const testSession = await createTestSession(sessionRepo);
    validSessionId = testSession.session_id;
    
    // Add test configuration data with proper auth setup
    await ConfigService.upsert('app.config_password', 'admin123', 'string', 'Configuration screen access password');
  });

  afterEach(async () => {
    // Clean up test configurations
    try {
      await ConfigService.deleteByKey('test_string_key');
      await ConfigService.deleteByKey('test_number_key');
      await ConfigService.deleteByKey('test_boolean_key');
      await ConfigService.deleteByKey('test_json_key');
      await ConfigService.deleteByKey('duplicate_key');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'test_value',
          type: 'string'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(401);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid authentication', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_password'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'test_value',
          type: 'string'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(401);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request validation', () => {
    it('should validate required fields', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({})
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details).toBeDefined();
    });

    it('should validate key format', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'invalid key with spaces',
          value: 'test_value',
          type: 'string'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate type field', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'test_value',
          type: 'invalid_type'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Type validation', () => {
    it('should validate number type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'not_a_number',
          type: 'number'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.value).toContain('Value must be a number for type "number"');
    });

    it('should validate boolean type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'not_a_boolean',
          type: 'boolean'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.value).toContain('Value must be a boolean for type "boolean"');
    });

    it('should validate json type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_key',
          value: 'not_an_object',
          type: 'json'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.value).toContain('Value must be an object for type "json"');
    });
  });

  describe('Successful creation', () => {
    it('should create string configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_string_key',
          value: 'test_string_value',
          type: 'string',
          description: 'Test string configuration'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.id).toBeDefined();
      expect(data.data?.key).toBe('test_string_key');
      expect(data.data?.value).toBe('test_string_value');
      expect(data.data?.type).toBe('string');
      expect(data.data?.description).toBe('Test string configuration');
      expect(data.data?.system_config).toBe(false);
      expect(data.data?.created_at).toBeDefined();
      expect(data.data?.updated_at).toBeDefined();
    });

    it('should create number configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_number_key',
          value: 42,
          type: 'number'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_number_key');
      expect(data.data?.value).toBe('42');
      expect(data.data?.type).toBe('number');
    });

    it('should create boolean configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_boolean_key',
          value: true,
          type: 'boolean'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_boolean_key');
      expect(data.data?.value).toBe('true');
      expect(data.data?.type).toBe('boolean');
    });

    it('should create json configuration', async () => {
      const jsonValue = { nested: { value: 'test' }, array: [1, 2, 3] };
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_json_key',
          value: jsonValue,
          type: 'json'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_json_key');
      expect(data.data?.value).toEqual(jsonValue);
      expect(data.data?.type).toBe('json');
    });

    it('should create system configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_system_key',
          value: 'system_value',
          type: 'string',
          system_config: true
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_system_key');
      expect(data.data?.system_config).toBe(true);
      
      // Cleanup
      await ConfigService.deleteByKey('test_system_key');
    });
  });

  describe('Duplicate key handling', () => {
    it('should reject duplicate keys', async () => {
      // First, create a config
      const createResponse = await app.fetch(new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'duplicate_key',
          value: 'first_value',
          type: 'string'
        })
      }));

      expect(createResponse.status).toBe(201);

      // Try to create another config with the same key
      const duplicateResponse = await app.fetch(new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'duplicate_key',
          value: 'second_value',
          type: 'string'
        })
      }));

      expect(duplicateResponse.status).toBe(409);
      const data = await duplicateResponse.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('DUPLICATE_KEY');
    });
  });

  describe('Validation rules', () => {
    it('should accept valid validation rules for string type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_string_validation',
          value: 'test_value',
          type: 'string',
          validation: {
            pattern: '^test_.*',
            required: true
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.validation).toEqual({
        pattern: '^test_.*',
        required: true
      });
      
      // Cleanup
      await ConfigService.deleteByKey('test_string_validation');
    });

    it('should accept valid validation rules for number type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_number_validation',
          value: 50,
          type: 'number',
          validation: {
            min: 0,
            max: 100
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(201);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.validation).toEqual({
        min: 0,
        max: 100
      });
      
      // Cleanup
      await ConfigService.deleteByKey('test_number_validation');
    });

    it('should reject min/max validation for non-number types', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_invalid_validation',
          value: 'test_value',
          type: 'string',
          validation: {
            min: 0,
            max: 100
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.validation).toContain('min/max validation is only applicable for number type');
    });

    it('should reject pattern validation for non-string types', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_invalid_pattern',
          value: 42,
          type: 'number',
          validation: {
            pattern: '^\\d+$'
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.validation).toContain('pattern validation is only applicable for string type');
    });

    it('should reject invalid regex patterns', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          key: 'test_invalid_regex',
          value: 'test_value',
          type: 'string',
          validation: {
            pattern: '[invalid regex'
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details?.validation).toContain('Invalid regular expression pattern');
    });
  });
});