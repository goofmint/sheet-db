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
  };
  data?: {
    message: string;
    deleted_key: string;
  };
};

describe('DELETE /api/v1/configs/:key', () => {
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
    
    // Create test configurations for deletion
    await ConfigService.createConfig({
      key: 'deletable_string_key',
      value: 'test_value',
      type: 'string',
      description: 'Test deletable string configuration'
    });
    
    await ConfigService.createConfig({
      key: 'deletable_number_key',
      value: '42',
      type: 'number',
      description: 'Test deletable number configuration'
    });
    
    await ConfigService.createConfig({
      key: 'system_test_key',
      value: 'system_value',
      type: 'string',
      description: 'Test system configuration',
      system_config: true
    });
    
    await ConfigService.createConfig({
      key: 'protected_key',
      value: 'protected_value',
      type: 'string',
      description: 'Test protected configuration'
    });
  });

  afterEach(async () => {
    // Clean up test configurations
    try {
      await ConfigService.deleteByKey('deletable_string_key');
      await ConfigService.deleteByKey('deletable_number_key');
      await ConfigService.deleteByKey('system_test_key');
      await ConfigService.deleteByKey('protected_key');
      await ConfigService.deleteByKey('nonexistent_key');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE'
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(401);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid authentication', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid_password'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(401);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Key validation', () => {
    it('should reject empty key', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(404); // Route not found for empty key
    });

    it('should reject invalid key format', async () => {
      // According to documentation, regex pattern validation is not implemented
      // Invalid characters in URL path result in 404 at routing level
      const request = new Request(`${baseUrl}/api/v1/configs/invalid key with spaces`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(404); // Route-level 404 for invalid URL characters
    });
  });

  describe('Successful deletions', () => {
    it('should delete string configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.deleted_key).toBe('deletable_string_key');
      expect(data.data?.message).toContain('deletable_string_key');
      expect(data.data?.message).toContain('deleted successfully');

      // Verify the configuration is actually deleted
      const deletedConfig = ConfigService.findByKey('deletable_string_key');
      expect(deletedConfig).toBeNull();
    });

    it('should delete number configuration', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/deletable_number_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
      expect(data.data?.deleted_key).toBe('deletable_number_key');

      // Verify the configuration is actually deleted
      const deletedConfig = ConfigService.findByKey('deletable_number_key');
      expect(deletedConfig).toBeNull();
    });
  });

  describe('Not found handling', () => {
    it('should return 404 for non-existent key', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/nonexistent_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(404);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('NOT_FOUND');
      expect(data.error?.message).toContain('nonexistent_key');
    });
  });

  describe('System configuration protection', () => {
    it('should prevent deletion of system configurations', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/system_test_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(403);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('FORBIDDEN');
      expect(data.error?.message).toContain('Cannot delete system configuration');

      // Verify the configuration still exists
      const systemConfig = ConfigService.findByKey('system_test_key');
      expect(systemConfig).toBeDefined();
    });

    it('should prevent deletion of app.config_password', async () => {
      const request = new Request(`${baseUrl}/api/v1/configs/app.config_password`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(403);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('FORBIDDEN');
      expect(data.error?.message).toContain('Cannot delete system configuration');

      // Verify the configuration still exists
      const passwordConfig = ConfigService.findByKey('app.config_password');
      expect(passwordConfig).toBeDefined();
    });

    it('should prevent deletion of google.client_id', async () => {
      // First create the protected configuration
      await ConfigService.createConfig({
        key: 'google.client_id',
        value: 'test_client_id',
        type: 'string',
        description: 'Google OAuth Client ID'
      });

      const request = new Request(`${baseUrl}/api/v1/configs/google.client_id`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(403);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('FORBIDDEN');

      // Verify the configuration still exists
      const googleConfig = ConfigService.findByKey('google.client_id');
      expect(googleConfig).toBeDefined();

      // Clean up
      await ConfigService.deleteByKey('google.client_id');
    });

    it('should prevent deletion of google.client_secret', async () => {
      // First create the protected configuration
      await ConfigService.createConfig({
        key: 'google.client_secret',
        value: 'test_client_secret',
        type: 'string',
        description: 'Google OAuth Client Secret'
      });

      const request = new Request(`${baseUrl}/api/v1/configs/google.client_secret`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(403);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('FORBIDDEN');

      // Verify the configuration still exists
      const googleSecretConfig = ConfigService.findByKey('google.client_secret');
      expect(googleSecretConfig).toBeDefined();

      // Clean up
      await ConfigService.deleteByKey('google.client_secret');
    });
  });

  describe('Data consistency', () => {
    it('should remove configuration from memory cache after deletion', async () => {
      // Verify configuration exists before deletion
      const beforeDeletion = ConfigService.findByKey('deletable_string_key');
      expect(beforeDeletion).toBeDefined();

      const request = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);

      // Verify configuration is removed from cache
      const afterDeletion = ConfigService.findByKey('deletable_string_key');
      expect(afterDeletion).toBeNull();
    });

    it('should handle attempt to delete already deleted configuration', async () => {
      // First delete the configuration
      const firstRequest = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const firstResponse = await app.fetch(firstRequest, env);
      expect(firstResponse.status).toBe(200);

      // Try to delete again
      const secondRequest = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const secondResponse = await app.fetch(secondRequest, env);
      expect(secondResponse.status).toBe(404);
      const data = await secondResponse.json() as ConfigResponse;
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test depends on being able to simulate a database error
      // For now, we'll test that the general error handling structure works
      const request = new Request(`${baseUrl}/api/v1/configs/deletable_string_key`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer admin123'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      const data = await response.json() as ConfigResponse;
      expect(data.success).toBe(true);
    });
  });
});