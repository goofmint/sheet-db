import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:test';
import app from '@/index';
import { ConfigService } from '@/services/config';
import { configTable } from '@/db/schema';
import { setupConfigDatabase, setupSessionDatabase } from '../../../utils/database-setup';
import { SessionRepository } from '@/repositories/session';
import { createTestSession } from '../../../utils/auth-utils';

interface ConfigItem {
  key: string;
  value: string;
  type: 'string' | 'boolean' | 'number' | 'json';
  description: string | null;
  system_config: boolean;
  validation: Record<string, string | number | boolean> | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ApiSingleSuccessResponse {
  success: true;
  data: ConfigItem;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiSingleResponse = ApiSingleSuccessResponse | ApiErrorResponse;


describe('GET /api/v1/configs/:key', () => {
  const db = drizzle(env.DB);
  const sessionRepo = new SessionRepository(db);

  beforeEach(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await setupSessionDatabase(db);
    await ConfigService.initialize(db);
    
    // Create test session for authentication
    await createTestSession(sessionRepo);
    
    // Add test configuration data
    await ConfigService.upsert('google.client_id', '12345-abcdef.apps.googleusercontent.com', 'string', 'Google OAuth2 Client ID');
    await ConfigService.upsert('app.config_password', 'admin123', 'string', 'Configuration screen access password');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean', 'Initial setup completion flag');
    await ConfigService.upsert('cache.default_ttl', '600', 'number', 'Default cache TTL in seconds');
    await ConfigService.upsert('features.enabled', '["notifications","export"]', 'json', 'Enabled features list');
  });

  describe('正常系', () => {
    it('認証済みユーザーは特定の設定項目を取得できる', async () => {
      const request = new Request('http://localhost/api/v1/configs/google.client_id', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        key: 'google.client_id',
        value: '12345-abcdef.apps.googleusercontent.com',
        type: 'string',
        description: 'Google OAuth2 Client ID',
        system_config: expect.any(Boolean),
        validation: expect.toSatisfy((val: Record<string, string | number | boolean> | null) => val === null || typeof val === 'object'),
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('boolean型の設定値が正しく変換される', async () => {
      const request = new Request('http://localhost/api/v1/configs/app.setup_completed', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.value).toBe(true);
      expect(data.data.type).toBe('boolean');
    });

    it('number型の設定値が正しく変換される', async () => {
      const request = new Request('http://localhost/api/v1/configs/cache.default_ttl', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.value).toBe(600);
      expect(data.data.type).toBe('number');
    });

    it('json型の設定値が正しく変換される', async () => {
      const request = new Request('http://localhost/api/v1/configs/features.enabled', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.value).toEqual(['notifications', 'export']);
      expect(data.data.type).toBe('json');
    });

    it('validationフィールドが正しくパースされる', async () => {
      // Add validation data to a config using direct database update after ConfigService initialization
      await db.update(configTable)
        .set({ 
          validation: JSON.stringify({
            required: true,
            minLength: 10,
            errorMessage: 'Must be at least 10 characters'
          })
        })
        .where(eq(configTable.key, 'google.client_id'));
      
      // Refresh cache to pick up the validation change
      await ConfigService.refreshCache();

      const request = new Request('http://localhost/api/v1/configs/google.client_id', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.validation).toMatchObject({
        required: true,
        minLength: 10,
        errorMessage: 'Must be at least 10 characters'
      });
    });
  });

  describe('異常系', () => {
    it('未認証ユーザーは401エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs/google.client_id');
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const data = await response.json() as ApiSingleResponse;
      expect(data.success).toBe(false);
      if (data.success) throw new Error("Expected error response");
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('無効な認証トークンで401エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs/google.client_id', {
        headers: { 
          'Authorization': 'Bearer invalid-token'
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const data = await response.json() as ApiSingleResponse;
      expect(data.success).toBe(false);
      if (data.success) throw new Error("Expected error response");
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('存在しない設定キーで404エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs/nonexistent.key', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(404);
      const data = await response.json() as ApiSingleResponse;
      expect(data.success).toBe(false);
      if (data.success) throw new Error("Expected error response");
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('nonexistent.key');
    });

    it('trailing slashは404エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs/', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      // Trailing slash doesn't match any route
      expect(response.status).toBe(404);
    });

    it('スペースのみの設定キーで400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs/%20%20%20', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
      const data = await response.json() as ApiSingleResponse;
      expect(data.success).toBe(false);
      if (data.success) throw new Error("Expected error response");
      expect(data.error.code).toBe('INVALID_KEY');
    });
  });

  describe('データ整合性', () => {
    it('不正なvalidation JSONは null として扱われる', async () => {
      // Add config with invalid validation JSON
      await db.update(configTable)
        .set({ validation: 'invalid-json' })
        .where(eq(configTable.key, 'google.client_id'));

      const request = new Request('http://localhost/api/v1/configs/google.client_id', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.validation).toBeNull();
    });

    it('system_configが正しくbooleanに変換される', async () => {
      const request = new Request('http://localhost/api/v1/configs/google.client_id', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(typeof data.data.system_config).toBe('boolean');
    });

    it('無効なnumber値はstring型のまま返される', async () => {
      // Directly insert invalid number value to database to bypass validation
      await db.insert(configTable).values({
        key: 'test.invalid_number',
        value: 'not-a-number',
        type: 'number',
        description: 'Invalid number test',
        system_config: 0,
        validation: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      await ConfigService.refreshCache();
      
      const request = new Request('http://localhost/api/v1/configs/test.invalid_number', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.value).toBe('not-a-number');
      expect(data.data.type).toBe('number');
    });

    it('無効なjson値はstring型のまま返される', async () => {
      // Directly insert invalid JSON value to database to bypass validation
      await db.insert(configTable).values({
        key: 'test.invalid_json',
        value: 'invalid-json',
        type: 'json',
        description: 'Invalid JSON test',
        system_config: 0,
        validation: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      await ConfigService.refreshCache();
      
      const request = new Request('http://localhost/api/v1/configs/test.invalid_json', {
        headers: { 
          'Authorization': 'Bearer admin123' 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json() as ApiSingleResponse;
      if (!data.success) throw new Error("Unexpected error response");
      expect(data.data.value).toBe('invalid-json');
      expect(data.data.type).toBe('json');
    });
  });
});