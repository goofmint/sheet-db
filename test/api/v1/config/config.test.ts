import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { env } from 'cloudflare:test';
import app from '@/index';
import { ConfigService } from '@/services/config';
import { setupConfigDatabase } from '../../../utils/database-setup';

describe('Config Management API', () => {
  const db = drizzle(env.DB);

  beforeEach(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await ConfigService.initialize(db);
    
    // Add required config for testing
    await ConfigService.upsert('app.config_password', 'testPassword123', 'string');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean');
    await ConfigService.upsert('google.client_secret', 'secret123', 'string');
    await ConfigService.upsert('google.client_id', 'client123', 'string');
  });

  describe('GET /config', () => {
    it('should show login form when not authenticated', async () => {
      const request = new Request('http://localhost/config');
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('Configuration Management');
      expect(html).toContain('A password is required to access the configuration screen');
      expect(html).toContain('<form method="post" action="/config/auth">');
      expect(html).toContain('type="password"');
    });

    it('should show config list when authenticated', async () => {
      const request = new Request('http://localhost/config', {
        headers: {
          'Cookie': 'config_auth=authenticated'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);
      const html = await response.text();
      
      expect(html).toContain('Configuration Management');
      expect(html).toContain('Configuration Key');
      expect(html).toContain('Value');
      expect(html).toContain('Description');
      expect(html).toContain('google.client_id');
      expect(html).toContain('client123'); // Non-sensitive data should be visible
      expect(html).toContain('****'); // Sensitive data should be masked
      expect(html).not.toContain('secret123'); // Secret should not be visible
    });
  });

  describe('POST /config/auth', () => {
    it('should authenticate with correct password', async () => {
      const formData = new FormData();
      formData.append('password', 'testPassword123');
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('config_auth=authenticated');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Max-Age=7200'); // 2 hours
    });

    it('should reject incorrect password', async () => {
      const formData = new FormData();
      formData.append('password', 'wrongPassword');
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=invalid_password');
    });

    it('should reject empty password', async () => {
      const formData = new FormData();
      formData.append('password', '');
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=password_required');
    });

    it('should handle URL-encoded form data', async () => {
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          password: 'testPassword123'
        })
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
    });

    it('should set secure cookie for HTTPS requests', async () => {
      const formData = new FormData();
      formData.append('password', 'testPassword123');
      
      const request = new Request('https://localhost/config/auth', {
        method: 'POST',
        body: formData
      });
      const response = await app.fetch(request, env);

      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=Strict');
    });
  });

  describe('GET /config/logout', () => {
    it('should clear auth cookie and redirect', async () => {
      const request = new Request('http://localhost/config/logout', {
        headers: {
          'Cookie': 'config_auth=authenticated'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('config_auth=');
      expect(setCookie).toContain('Max-Age=0'); // Cookie deletion
    });

    it('should work without existing auth cookie', async () => {
      const request = new Request('http://localhost/config/logout');
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
    });
  });

  describe('ConfigService extensions', () => {
    it('should return all config entries with getAll', () => {
      const allConfigs = ConfigService.getAll();
      
      expect(typeof allConfigs).toBe('object');
      expect(allConfigs['app.config_password']).toBe('testPassword123');
      expect(allConfigs['google.client_id']).toBe('client123');
      expect(allConfigs['google.client_secret']).toBe('secret123');
    });

    it('should return correct types with getType', () => {
      expect(ConfigService.getType('app.setup_completed')).toBe('boolean');
      expect(ConfigService.getType('app.config_password')).toBe('string');
      expect(ConfigService.getType('nonexistent.key')).toBe('string'); // default
    });
  });
});