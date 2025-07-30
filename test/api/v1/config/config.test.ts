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
      expect(html).toContain('name="csrf_token"'); // Check for CSRF token
      
      // Check that CSRF cookie is set
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('csrf_token=');
    });

    it('should show config list when authenticated', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      
      const request = new Request('http://localhost/config', {
        headers: {
          'Cookie': sessionCookie
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
      expect(html).toContain('data-field-type="sensitive"'); // Sensitive fields should have sensitive marker
      expect(html).toContain('type="password"'); // Sensitive fields should be password type
      expect(html).toContain('<form id="configForm"'); // Should be a form now
      expect(html).toContain('action="/config/update"'); // Form should post to config update endpoint
    });

    it('should display editable form with all required elements', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      
      const request = new Request('http://localhost/config', {
        headers: {
          'Cookie': sessionCookie
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check form structure
      expect(html).toContain('<form id="configForm"');
      expect(html).toContain('method="post"');
      expect(html).toContain('action="/config/update"');
      expect(html).toContain('name="csrf_token"');
      
      // Check form controls
      expect(html).toContain('Save All');
      expect(html).toContain('Reset All');
      expect(html).toContain('0 changes');
      
      // Check action buttons
      expect(html).toContain('reset-btn');
      expect(html).toContain('validate-btn');
      expect(html).toContain('Actions'); // Actions column header
      
      // Check data attributes for change tracking
      expect(html).toContain('data-original');
      expect(html).toContain('data-field-type');
    });

    it('should have proper input types for different field types', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      
      const request = new Request('http://localhost/config', {
        headers: {
          'Cookie': sessionCookie
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Sensitive fields should be password type
      expect(html).toContain('name="google.client_secret"');
      expect(html).toContain('type="password"');
      expect(html).toContain('name="app.config_password"');
      
      // Non-sensitive fields should be text type
      expect(html).toContain('name="google.client_id"');
      expect(html).toContain('type="text"');
      
      // Boolean fields should be checkboxes
      expect(html).toContain('name="app.setup_completed"');
      expect(html).toContain('type="checkbox"');
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

  describe('POST /config/auth', () => {
    it('should authenticate with correct password and CSRF token', async () => {
      const response = await authenticateUser();

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('config_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Max-Age=7200'); // 2 hours
    });

    it('should reject request without CSRF token', async () => {
      const formData = new FormData();
      formData.append('password', 'testPassword123');
      // No CSRF token provided
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=csrf_invalid');
    });
    
    it('should reject incorrect password', async () => {
      // Get CSRF token first
      const getRequest = new Request('http://localhost/config');
      const getResponse = await app.fetch(getRequest, env);
      const csrfToken = await extractCSRFToken(getResponse);
      
      const formData = new FormData();
      formData.append('password', 'wrongPassword');
      formData.append('csrf_token', csrfToken);
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        headers: {
          'Cookie': extractCSRFCookie(getResponse)
        },
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=invalid_password');
    });

    it('should reject empty password', async () => {
      // Get CSRF token first
      const getRequest = new Request('http://localhost/config');
      const getResponse = await app.fetch(getRequest, env);
      const csrfToken = await extractCSRFToken(getResponse);
      
      const formData = new FormData();
      formData.append('password', '');
      formData.append('csrf_token', csrfToken);
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        headers: {
          'Cookie': extractCSRFCookie(getResponse)
        },
        body: formData
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=password_required');
    });

    it('should handle URL-encoded form data', async () => {
      // Get CSRF token first
      const getRequest = new Request('http://localhost/config');
      const getResponse = await app.fetch(getRequest, env);
      const csrfToken = await extractCSRFToken(getResponse);
      
      const request = new Request('http://localhost/config/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': extractCSRFCookie(getResponse)
        },
        body: new URLSearchParams({
          password: 'testPassword123',
          csrf_token: csrfToken
        })
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
    });

    it('should set secure cookie for HTTPS requests', async () => {
      // Get CSRF token first
      const getRequest = new Request('https://localhost/config');
      const getResponse = await app.fetch(getRequest, env);
      const csrfToken = await extractCSRFToken(getResponse);
      
      const formData = new FormData();
      formData.append('password', 'testPassword123');
      formData.append('csrf_token', csrfToken);
      
      const request = new Request('https://localhost/config/auth', {
        method: 'POST',
        headers: {
          'Cookie': extractCSRFCookie(getResponse)
        },
        body: formData
      });
      const response = await app.fetch(request, env);

      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('SameSite=Strict');
    });
  });

  describe('GET /config/logout', () => {
    it('should clear session and CSRF cookies and redirect', async () => {
      const request = new Request('http://localhost/config/logout', {
        headers: {
          'Cookie': 'config_session=test; csrf_token=test'
        }
      });
      const response = await app.fetch(request, env);

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('config_session=');
      expect(setCookie).toContain('csrf_token=');
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