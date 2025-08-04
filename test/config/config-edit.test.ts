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
    it('should always show login form with client-side authentication', async () => {
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
      expect(html).toContain('auth-form');
      expect(html).toContain('config-container');
      expect(html).toContain('/statics/config/client.js');
    });

    it('should provide client-side authentication capability via JavaScript', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check that client.js is loaded for authentication handling
      expect(html).toContain('/statics/config/client.js');
      expect(html).toContain('password-form');
      expect(html).toContain('password-input');
      expect(html).toContain('config-row-template');
    });
  });

  describe('Config Edit Interface', () => {
    it('should include template elements for config display', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check for template definitions in the HTML
      expect(html).toContain('config-row-template');
      expect(html).toContain('config-value-text-template');
      expect(html).toContain('config-value-secret-template');
      expect(html).toContain('config-value-boolean-template');
      
      // Check for client-side JavaScript inclusion
      expect(html).toContain('/statics/config/client.js');
      
      // Check that config container exists but is hidden initially
      expect(html).toContain('config-container');
      expect(html).toContain('style="display: none;"');
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

  describe('Client-side Authentication', () => {
    it('should provide logout button in config container', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config', {
          method: 'GET',
        }),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      
      // Check that logout button exists in the config container
      expect(html).toContain('logout-btn');
      expect(html).toContain('id="logout-btn"');
      expect(html).toContain('Logout');
    });
  });

  // Helper function to extract CSRF token from HTML
  async function extractCSRFToken(response: Response): Promise<string> {
    const html = await response.text();
    const match = html.match(/name="csrf_token" value="([^"]+)"/);
    return match ? match[1] : '';
  }
});