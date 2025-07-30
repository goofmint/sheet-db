import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import app from '@/index';
import { env } from 'cloudflare:test';
import { setupConfigDatabase } from '../utils/database-setup';

describe('Config Edit Functionality', () => {
  const db = drizzle(env.DB);

  beforeAll(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await ConfigService.initialize(db);
    
    // Add required config for testing
    await ConfigService.upsert('app.config_password', 'testPassword123', 'string');
    await ConfigService.upsert('app.setup_completed', 'true', 'boolean');
    await ConfigService.upsert('google.client_secret', 'secret123', 'string');
    await ConfigService.upsert('google.client_id', 'client123', 'string');
    await ConfigService.upsert('auth0.domain', 'test.auth0.com', 'string');
    await ConfigService.upsert('storage.type', 'r2', 'string');
  });

  describe('Config Page Access', () => {
    it('should show login form when not authenticated', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Configuration Management');
      expect(html).toContain('password');
      expect(html).toContain('Login');
    });

    it('should authenticate with correct password', async () => {
      const response = await authenticateUser();

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      expect(response.headers.get('Set-Cookie')).toContain('config_session');
    });

    it('should reject invalid password', async () => {
      // First get CSRF token
      const getRequest = new Request('http://localhost/config');
      const getResponse = await app.fetch(getRequest, env);
      const csrfToken = await extractCSRFToken(getResponse);
      
      const formData = new FormData();
      formData.append('password', 'wrongpassword');
      formData.append('csrf_token', csrfToken);

      const response = await app.fetch(
        new Request('http://localhost/config/auth', {
          method: 'POST',
          body: formData,
          headers: {
            'Cookie': extractCSRFCookie(getResponse)
          },
        }),
        env
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=invalid_password');
    });
  });

  describe('Config Edit Interface', () => {
    it('should display editable config form when authenticated', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
          headers: {
            'Cookie': sessionCookie
          },
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for editable form elements
      expect(html).toContain('Save All');
      expect(html).toContain('Reset All');
      expect(html).toContain('data-original=');
      expect(html).toContain('type="password"');
      
      // Check for config values
      expect(html).toContain('google.client_id');
      expect(html).toContain('auth0.domain');
      expect(html).toContain('app.config_password');
    });


  });

  describe('Config Update via API', () => {
    it('should update configuration via POST /api/v1/setup with Bearer token', async () => {
      const updateData = {
        'google.client_id': 'updated-google-client-id',
        'google.client_secret': 'updated-google-secret',
        'auth0.domain': 'updated.auth0.com',
        'app.setup_completed': true
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer testPassword123'
          },
          body: JSON.stringify(updateData),
        }),
        env
      );

      expect(response.status).toBe(200);
      const result = await response.json() as { success: boolean; message?: string };
      expect(result.success).toBe(true);

      // Verify configs were updated
      expect(ConfigService.getString('google.client_id')).toBe('updated-google-client-id');
      expect(ConfigService.getString('auth0.domain')).toBe('updated.auth0.com');
    });

    it('should reject update with invalid Bearer token', async () => {
      const updateData = {
        'google.client_id': 'test'
      };

      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer wrongPassword'
          },
          body: JSON.stringify(updateData),
        }),
        env
      );

      expect(response.status).toBe(401);
      const result = await response.json() as { error: { code: string; message: string } };
      expect(result.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('Logout Functionality', () => {
    it('should logout and clear session', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      const csrfCookie = extractCSRFCookie(loginResponse);
      
      // Get fresh CSRF token from the config page after authentication
      const configRequest = new Request('http://localhost/config', {
        headers: {
          'Cookie': `${sessionCookie}; ${csrfCookie}`
        }
      });
      const configResponse = await app.fetch(configRequest, env);
      const csrfToken = await extractCSRFToken(configResponse);
      const freshCSRFCookie = extractCSRFCookie(configResponse);

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);

      const response = await app.fetch(
        new Request('http://localhost/config/logout', {
          method: 'POST',
          body: formData,
          headers: {
            'Cookie': `${sessionCookie}; ${freshCSRFCookie || csrfCookie}`,
          },
        }),
        env
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      // Check that session cookie is cleared
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('config_session=');
      expect(setCookie).toContain('Max-Age=0');
    });
  });

  // Helper function to authenticate a user and get session cookies
  async function authenticateUser(): Promise<Response> {
    // First get CSRF token
    const getRequest = new Request('http://localhost/config');
    const getResponse = await app.fetch(getRequest, env);
    const csrfToken = await extractCSRFToken(getResponse);
    
    // Then authenticate with CSRF token
    const formData = new FormData();
    formData.append('password', 'testPassword123');
    formData.append('csrf_token', csrfToken);
    
    const authRequest = new Request('http://localhost/config/auth', {
      method: 'POST',
      headers: {
        'Cookie': extractCSRFCookie(getResponse)
      },
      body: formData
    });
    
    return await app.fetch(authRequest, env);
  }
  
  async function extractCSRFToken(response: Response): Promise<string> {
    const html = await response.text();
    const match = html.match(/name="csrf_token" value="([^"]+)"/);
    return match ? match[1] : '';
  }
  
  function extractCSRFCookie(response: Response): string {
    const setCookie = response.headers.get('Set-Cookie') || '';
    const match = setCookie.match(/csrf_token=([^;]+)/);
    return match ? `csrf_token=${match[1]}` : '';
  }
  
  function extractSessionCookie(response: Response): string {
    const setCookie = response.headers.get('Set-Cookie') || '';
    const match = setCookie.match(/config_session=([^;]+)/);
    return match ? `config_session=${match[1]}` : '';
  }
});