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
    validation: Record<string, string | number | boolean> | null;
    created_at: string;
    updated_at: string;
  };
};

describe('PUT /api/v1/configs/:key', () => {
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
    
    // Create test configurations for updating
    await ConfigService.createConfig({
      key: 'test_string_key',
      value: 'original_value',
      type: 'string',
      description: 'Test string configuration'
    });
    
    await ConfigService.createConfig({
      key: 'test_number_key',
      value: '42',
      type: 'number',
      description: 'Test number configuration'
    });
    
    await ConfigService.createConfig({
      key: 'test_boolean_key',
      value: 'true',
      type: 'boolean',
      description: 'Test boolean configuration'
    });
    
    await ConfigService.createConfig({
      key: 'test_json_key',
      value: JSON.stringify({ foo: 'bar' }),
      type: 'json',
      description: 'Test JSON configuration'
    });
  });

  afterEach(async () => {
    // Clean up test configurations
    try {
      await ConfigService.deleteByKey('test_string_key');
      await ConfigService.deleteByKey('test_number_key');
      await ConfigService.deleteByKey('test_boolean_key');
      await ConfigService.deleteByKey('test_json_key');
      await ConfigService.deleteByKey('updated_key');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: 'updated_value',
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
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_password'
        },
        body: JSON.stringify({
          value: 'updated_value',
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
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
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

    it('should validate type field', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
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
      const request = new Request(`${baseUrl}/api/v1/configs/test_number_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'not_a_number',
          type: 'number'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate boolean type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_boolean_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'not_a_boolean',
          type: 'boolean'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should validate json type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_json_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'not_an_object',
          type: 'json'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Successful updates', () => {
    it('should update string configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'updated_string_value',
          type: 'string',
          description: 'Updated test string configuration'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_string_key');
      expect(data.data?.value).toBe('updated_string_value');
      expect(data.data?.type).toBe('string');
      expect(data.data?.description).toBe('Updated test string configuration');
    });

    it('should update number configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_number_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 100,
          type: 'number',
          description: 'Updated test number configuration'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_number_key');
      expect(data.data?.value).toBe(100);
      expect(data.data?.type).toBe('number');
    });

    it('should update boolean configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_boolean_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: false,
          type: 'boolean',
          description: 'Updated test boolean configuration'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_boolean_key');
      expect(data.data?.value).toBe(false);
      expect(data.data?.type).toBe('boolean');
    });

    it('should update json configuration', async () => {
      const newJsonValue = { updated: true, count: 123 };
      const request = new Request(`${baseUrl}/api/v1/configs/test_json_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: newJsonValue,
          type: 'json',
          description: 'Updated test JSON configuration'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.key).toBe('test_json_key');
      expect(data.data?.value).toEqual(newJsonValue);
      expect(data.data?.type).toBe('json');
    });

    it('should update system configuration flag', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'system_value',
          type: 'string',
          system_config: true
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.system_config).toBe(true);
    });
  });

  describe('Not found handling', () => {
    it('should return 404 for non-existent key', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/nonexistent_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'test_value',
          type: 'string'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(404);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Validation rules', () => {
    it('should accept valid validation rules for string type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'test_value',
          type: 'string',
          validation: {
            pattern: '^test_.*',
            minLength: 5,
            maxLength: 50
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.validation).toMatchObject({
        pattern: '^test_.*',
        minLength: 5,
        maxLength: 50
      });
    });

    it('should accept valid validation rules for number type', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_number_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 75,
          type: 'number',
          validation: {
            min: 0,
            max: 100
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.validation).toMatchObject({
        min: 0,
        max: 100
      });
    });

    it('should reject min/max validation for non-number types', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'test_value',
          type: 'string',
          validation: {
            min: 5,
            max: 10
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject pattern validation for non-string types', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_number_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
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
    });

    it('should reject invalid regex patterns', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'test_value',
          type: 'string',
          validation: {
            pattern: '[invalid-regex('
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should reject minLength/maxLength validation for non-string types', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/test_number_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 42,
          type: 'number',
          validation: {
            minLength: 1,
            maxLength: 10
          }
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(400);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Data consistency', () => {
    it('should preserve created_at and update updated_at', async () => {
      // First, get the original config to check created_at
      const originalConfig = ConfigService.findByKey('test_string_key');
      expect(originalConfig).toBeDefined();
      
      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'updated_value',
          type: 'string'
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      
      // created_at should remain the same
      expect(data.data?.created_at).toBe(originalConfig!.created_at);
      
      // updated_at should be different
      expect(data.data?.updated_at).not.toBe(originalConfig!.updated_at);
    });

    it('should handle validation field JSON parsing correctly', async () => {
      const validationRules = {
        required: true,
        minLength: 5,
        pattern: '^test_.*'
      };

      const request = new Request(`${baseUrl}/api/v1/configs/test_string_key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer admin123'
        },
        body: JSON.stringify({
          value: 'test_value',
          type: 'string',
          validation: validationRules
        })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.validation).toEqual(validationRules);
    });
  });
});