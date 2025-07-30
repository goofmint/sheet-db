import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import app from '@/index';
import { ConfigService } from '@/services/config';
import { setupConfigDatabase } from '../../utils/database-setup';

describe('Setup API', () => {
  const db = drizzle(env.DB);

  beforeEach(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await ConfigService.initialize(db);
    
    // Add required config for testing
    await ConfigService.upsert('app.config_password', 'testPassword123', 'string');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean');
    await ConfigService.upsert('google.client_secret', 'old_secret', 'string');
    await ConfigService.upsert('google.client_id', 'old_client_id', 'string');
    await ConfigService.upsert('auth0.domain', 'old.auth0.com', 'string');
    await ConfigService.upsert('storage.type', 'r2', 'string');
  });

  describe('POST /api/v1/setup', () => {
    it('should update configuration with valid data and Bearer token authentication', async () => {
      const configData = {
        'google.client_id': 'new_client_id',
        'google.client_secret': 'new_secret',
        'auth0.domain': 'new.auth0.com',
        'app.setup_completed': true,
        'storage.type': 'google_drive'
      };
      
      const request = new Request('http://localhost/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer testPassword123'
        },
        body: JSON.stringify(configData)
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      
      // Verify configurations were updated
      expect(ConfigService.getString('google.client_id')).toBe('new_client_id');
      expect(ConfigService.getString('google.client_secret')).toBe('new_secret');
      expect(ConfigService.getString('auth0.domain')).toBe('new.auth0.com');
      expect(ConfigService.getBoolean('app.setup_completed')).toBe(true);
      expect(ConfigService.getString('storage.type')).toBe('google_drive');
    });

    it('should handle boolean values correctly', async () => {
      const configData = {
        'google.client_id': 'test_client_id',
        'google.client_secret': 'test_secret',
        'auth0.domain': 'test.auth0.com',
        'app.setup_completed': true,
        'storage.type': 'r2'
      };
      
      const request = new Request('http://localhost/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer testPassword123'
        },
        body: JSON.stringify(configData)
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(ConfigService.getBoolean('app.setup_completed')).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const configData = {
        'google.client_id': 'new_client_id'
      };
      
      const request = new Request('http://localhost/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error.code).toBe('AUTHENTICATION_REQUIRED');
      
      // Verify configurations were not updated
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
    });

    it('should reject request with invalid Bearer token', async () => {
      const configData = {
        'google.client_id': 'new_client_id'
      };
      
      const request = new Request('http://localhost/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer wrongPassword'
        },
        body: JSON.stringify(configData)
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error.code).toBe('AUTHENTICATION_REQUIRED');
      
      // Verify configurations were not updated
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
    });

    it('should handle empty data gracefully', async () => {
      const configData = {};
      
      const request = new Request('http://localhost/api/v1/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer testPassword123'
        },
        body: JSON.stringify(configData)
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      
      // Original values should remain unchanged
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
      expect(ConfigService.getString('google.client_secret')).toBe('old_secret');
    });
  });

  it('should preserve existing config types during updates', async () => {
    // First set some config with specific types
    await ConfigService.upsert('cache.max_entries', '100', 'number');
    await ConfigService.upsert('app.debug', 'true', 'boolean');
    
    const configData = {
      'cache.max_entries': '200',
      'app.debug': false
    };
    
    const request = new Request('http://localhost/api/v1/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer testPassword123'
      },
      body: JSON.stringify(configData)
    });
    
    const response = await app.fetch(request, env);
    
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    
    // Verify values were updated but types preserved
    expect(ConfigService.getNumber('cache.max_entries')).toBe(200);
    expect(ConfigService.getBoolean('app.debug')).toBe(false);
    expect(ConfigService.getType('cache.max_entries')).toBe('number');
    expect(ConfigService.getType('app.debug')).toBe('boolean');
  });
});