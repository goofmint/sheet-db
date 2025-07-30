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
    await ConfigService.upsert('app.setup_completed', 'false', 'boolean');
    await ConfigService.upsert('google.client_secret', 'old_secret', 'string');
    await ConfigService.upsert('google.client_id', 'old_client_id', 'string');
    await ConfigService.upsert('auth0.domain', 'old.auth0.com', 'string');
    await ConfigService.upsert('storage.type', 'r2', 'string');
  });

  describe('POST /config/update', () => {
    it('should update configuration with valid data and CSRF protection', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      const newCSRFCookie = extractCSRFCookie(loginResponse); // Get new CSRF cookie from auth response
      
      // Get CSRF token from the config page
      const configRequest = new Request('http://localhost/config', {
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        }
      });
      const configResponse = await app.fetch(configRequest, env);
      const csrfToken = await extractCSRFToken(configResponse);


      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('google.client_id', 'new_client_id');
      formData.append('google.client_secret', 'new_secret');
      formData.append('auth0.domain', 'new.auth0.com');
      formData.append('app.setup_completed', 'true');
      formData.append('storage.type', 'google_drive');
      
      const request = new Request('http://localhost/config/update', {
        method: 'POST',
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        },
        body: formData
      });
      
      const response = await app.fetch(request, env);
      
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?success=updated');
      
      // Verify configurations were updated
      expect(ConfigService.getString('google.client_id')).toBe('new_client_id');
      expect(ConfigService.getString('google.client_secret')).toBe('new_secret');
      expect(ConfigService.getString('auth0.domain')).toBe('new.auth0.com');
      expect(ConfigService.getBoolean('app.setup_completed')).toBe(true);
      expect(ConfigService.getString('storage.type')).toBe('google_drive');
    });

    it('should handle checkbox values correctly', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      const newCSRFCookie = extractCSRFCookie(loginResponse);
      
      // Get CSRF token from the config page
      const configRequest = new Request('http://localhost/config', {
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        }
      });
      const configResponse = await app.fetch(configRequest, env);
      const csrfToken = await extractCSRFToken(configResponse);

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('google.client_id', 'test_client_id');
      formData.append('google.client_secret', 'test_secret');
      formData.append('auth0.domain', 'test.auth0.com');
      // Checkbox checked
      formData.append('app.setup_completed', 'on');
      formData.append('storage.type', 'r2');
      
      const request = new Request('http://localhost/config/update', {
        method: 'POST',
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        },
        body: formData
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(302);
      expect(ConfigService.getBoolean('app.setup_completed')).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const formData = new FormData();
      formData.append('csrf_token', 'fake_token');
      formData.append('google.client_id', 'new_client_id');
      
      const request = new Request('http://localhost/config/update', {
        method: 'POST',
        body: formData
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
      
      // Verify configurations were not updated
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
    });

    it('should reject request without CSRF token', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      const newCSRFCookie = extractCSRFCookie(loginResponse);

      const formData = new FormData();
      // No CSRF token
      formData.append('google.client_id', 'new_client_id');
      
      const request = new Request('http://localhost/config/update', {
        method: 'POST',
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        },
        body: formData
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=csrf_invalid');
      
      // Verify configurations were not updated
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
    });

    it('should handle empty form data gracefully', async () => {
      // First, authenticate to get a valid session token
      const loginResponse = await authenticateUser();
      const sessionCookie = extractSessionCookie(loginResponse);
      const newCSRFCookie = extractCSRFCookie(loginResponse);
      
      // Get CSRF token from the config page
      const configRequest = new Request('http://localhost/config', {
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        }
      });
      const configResponse = await app.fetch(configRequest, env);
      const csrfToken = await extractCSRFToken(configResponse);

      const formData = new FormData();
      formData.append('csrf_token', csrfToken);
      // Only send CSRF token, no other data
      
      const request = new Request('http://localhost/config/update', {
        method: 'POST',
        headers: {
          'Cookie': `${sessionCookie}; ${newCSRFCookie}`
        },
        body: formData
      });
      
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?success=updated');
      
      // Original values should remain unchanged
      expect(ConfigService.getString('google.client_id')).toBe('old_client_id');
      expect(ConfigService.getString('google.client_secret')).toBe('old_secret');
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