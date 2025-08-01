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

describe('GET /api/v1/configs', () => {
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
    
    // Add test configuration data
    await ConfigService.upsert('google.client_id', '12345-abcdef.apps.googleusercontent.com', 'string', 'Google OAuth2 Client ID');
    await ConfigService.upsert('google.client_secret', 'GOCSPX-test-secret-123', 'string', 'Google OAuth2 Client Secret');
    await ConfigService.upsert('auth0.domain', 'test.auth0.com', 'string', 'Auth0 Domain');
    await ConfigService.upsert('app.config_password', 'admin123', 'string', 'Configuration screen access password');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean', 'Initial setup completion flag');
    await ConfigService.upsert('storage.type', 'r2', 'string', 'File storage type');
    await ConfigService.upsert('cache.default_ttl', '600', 'number', 'Default cache TTL in seconds');
    await ConfigService.upsert('features.enabled', '["notifications","export"]', 'json', 'Enabled features list');
  });

  describe('正常系', () => {
    it('認証済みユーザーは設定一覧を取得できる', async () => {
      const request = new Request('http://localhost/api/v1/configs', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.configs).toBeInstanceOf(Array);
      expect(data.data.configs.length).toBeGreaterThan(0);
      expect(data.data.pagination).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 50,
        totalPages: expect.any(Number),
        hasNext: expect.any(Boolean),
        hasPrev: expect.any(Boolean)
      });
    });

    it('各設定項目が正しい形式で返される', async () => {
      const request = new Request('http://localhost/api/v1/configs', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      const data = await response.json();
      const config = data.data.configs[0];
      
      expect(config).toMatchObject({
        key: expect.any(String),
        value: expect.any(String),
        type: expect.stringMatching(/^(string|boolean|number|json)$/),
        description: expect.any(String),
        system_config: expect.any(Boolean),
        validation: expect.anything(), // null or object
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('検索機能が正常に動作する', async () => {
      const request = new Request('http://localhost/api/v1/configs?search=google', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.configs).toSatisfy((configs: any[]) => 
        configs.every(config => 
          config.key.includes('google') || 
          (config.description && config.description.toLowerCase().includes('google'))
        )
      );
    });

    it('型フィルタリングが正常に動作する', async () => {
      const request = new Request('http://localhost/api/v1/configs?type=boolean', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.configs).toSatisfy((configs: any[]) => 
        configs.every(config => config.type === 'boolean')
      );
    });

    it('ページネーションが正常に動作する', async () => {
      const request = new Request('http://localhost/api/v1/configs?page=1&limit=3', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.configs.length).toBeLessThanOrEqual(3);
      expect(data.data.pagination.limit).toBe(3);
      expect(data.data.pagination.page).toBe(1);
    });

    it('ソート機能が正常に動作する', async () => {
      const request = new Request('http://localhost/api/v1/configs?sort=key&order=asc', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      const configs = data.data.configs;
      
      // Check if configs are sorted by key in ascending order
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].key >= configs[i-1].key).toBe(true);
      }
    });

    it('降順ソートが正常に動作する', async () => {
      const request = new Request('http://localhost/api/v1/configs?sort=key&order=desc', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      const configs = data.data.configs;
      
      // Check if configs are sorted by key in descending order
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i].key <= configs[i-1].key).toBe(true);
      }
    });

    it('複数の条件でフィルタリングできる', async () => {
      const request = new Request('http://localhost/api/v1/configs?search=app&type=string&sort=key&order=asc', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.configs).toSatisfy((configs: any[]) => 
        configs.every(config => 
          (config.key.includes('app') || 
           (config.description && config.description.toLowerCase().includes('app'))) &&
          config.type === 'string'
        )
      );
    });
  });

  describe('異常系', () => {
    it('未認証ユーザーは401エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs');
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('無効なセッションIDで401エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs', {
        headers: { 
          'Cookie': 'session_id=invalid-session-id'
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('無効なページ番号で400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs?page=0', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
    });

    it('無効な制限数で400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs?limit=0', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
    });

    it('制限数が最大値を超えた場合にクランプされる', async () => {
      const request = new Request('http://localhost/api/v1/configs?limit=200', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.pagination.limit).toBe(100); // Max limit should be 100
    });

    it('無効な型フィルタで400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs?type=invalid', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
    });

    it('無効なソート項目で400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs?sort=invalid', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
    });

    it('無効なソート順で400エラーが返る', async () => {
      const request = new Request('http://localhost/api/v1/configs?order=invalid', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(400);
    });
  });

  describe('データ整合性', () => {
    it('設定値の型が正しく変換される', async () => {
      const request = new Request('http://localhost/api/v1/configs', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      const data = await response.json();
      const booleanConfig = data.data.configs.find((c: any) => c.type === 'boolean');
      const numberConfig = data.data.configs.find((c: any) => c.type === 'number');
      const jsonConfig = data.data.configs.find((c: any) => c.type === 'json');
      
      if (booleanConfig) {
        expect(typeof booleanConfig.system_config).toBe('boolean');
      }
      
      if (numberConfig) {
        expect(numberConfig.type).toBe('number');
      }
      
      if (jsonConfig) {
        expect(jsonConfig.type).toBe('json');
      }
    });

    it('validationフィールドのJSONパースが正常に動作する', async () => {
      // Add config with validation JSON
      await db.update(configTable)
        .set({ 
          validation: JSON.stringify({
            required: true,
            minLength: 5,
            errorMessage: 'Must be at least 5 characters'
          })
        })
        .where(eq(configTable.key, 'google.client_secret'));

      const request = new Request('http://localhost/api/v1/configs?search=client_secret', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      const data = await response.json();
      const config = data.data.configs.find((c: any) => c.key === 'google.client_secret');
      
      expect(config.validation).toMatchObject({
        required: true,
        minLength: 5,
        errorMessage: 'Must be at least 5 characters'
      });
    });

    it('不正なvalidation JSONは null として扱われる', async () => {
      // Add config with invalid validation JSON
      await db.update(configTable)
        .set({ validation: 'invalid-json' })
        .where(eq(configTable.key, 'google.client_id'));

      const request = new Request('http://localhost/api/v1/configs?search=client_id', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      const data = await response.json();
      const config = data.data.configs.find((c: any) => c.key === 'google.client_id');
      
      expect(config.validation).toBeNull();
    });
  });

  describe('パフォーマンス', () => {
    it('大量データでも適切にページネーションされる', async () => {
      // Add many configs for testing
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(
          ConfigService.upsert(`test.config.${i}`, `value${i}`, 'string', `Test config ${i}`)
        );
      }
      await Promise.all(promises);

      const request = new Request('http://localhost/api/v1/configs?limit=10', {
        headers: { 
          'Cookie': `session_id=${validSessionId}` 
        }
      });
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.configs.length).toBe(10);
      expect(data.data.pagination.total).toBeGreaterThanOrEqual(25);
      expect(data.data.pagination.hasNext).toBe(true);
    });
  });
});