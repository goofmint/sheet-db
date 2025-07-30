import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../src/index';
import { setupTestDatabase } from './utils/database-setup';
import { ConfigService } from '../src/services/config';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

describe('Setup UI Integration Tests', () => {
  let db: DrizzleD1Database;

  beforeAll(async () => {
    // Get real D1 database from cloudflare:test environment
    db = drizzle(env.DB);
    
    // Setup test database with all tables
    await setupTestDatabase(db);
    
    // Initialize ConfigService with real database
    await ConfigService.initialize(db);
  });

  beforeEach(async () => {
    // Clear all Config data before each test to ensure isolation
    await env.DB.prepare('DELETE FROM Config').run();
    await ConfigService.refreshCache();
  });

  describe('GET /setup HTML Response', () => {
    it('should return HTML page with correct content type', async () => {
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('<title>SheetDB Setup</title>');
      expect(html).toContain('<h1>SheetDB Setup</h1>');
    });

    it('should include CSS and JavaScript files', async () => {
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      const html = await response.text();
      
      expect(html).toContain('<link rel="stylesheet" href="/statics/setup/style.css"');
      expect(html).toContain('<script src="/statics/setup/app.js">');
    });

    it('should have proper form structure', async () => {
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      const html = await response.text();
      
      // Check for form elements
      expect(html).toContain('id="setup-form"');
      expect(html).toContain('name="google.clientId"');
      expect(html).toContain('name="auth0.domain"');
      expect(html).toContain('name="app.configPassword"');
    });

    it('should have authentication section (hidden by default)', async () => {
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      const html = await response.text();
      
      expect(html).toContain('id="auth-section"');
      expect(html).toContain('style="display: none;"');
    });

    it('should have status display section (hidden by default)', async () => {
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      const html = await response.text();
      
      expect(html).toContain('id="status-display"');
      expect(html).toContain('Go to Playground');
    });
  });

  describe('Static Assets', () => {
    it('should serve CSS file correctly', async () => {
      const response = await env.ASSETS.fetch(new Request('http://localhost/statics/setup/style.css'));
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/css');
      
      const css = await response.text();
      expect(css).toContain('.container');
      expect(css).toContain('.setup-form');
    });

    it('should serve JavaScript file correctly', async () => {
      const response = await env.ASSETS.fetch(new Request('http://localhost/statics/setup/app.js'));
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/javascript');
      
      const js = await response.text();
      expect(js).toContain('class SetupManager');
      expect(js).toContain('checkSetupStatus');
    });
  });

  describe('Form Behavior with API Integration', () => {
    it('should handle setup status check on page load', async () => {
      // No setup configured (cleared in beforeEach)
      
      const request = new Request('http://localhost/setup');
      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);
      
      // Verify that GET /api/v1/setup returns setup not completed
      const apiRequest = new Request('http://localhost/api/v1/setup');
      const apiResponse = await app.fetch(apiRequest, env);
      expect(apiResponse.status).toBe(200);
      
      const data = await apiResponse.json() as { setup: { isCompleted: boolean } };
      expect(data.setup.isCompleted).toBe(false);
    });

    it('should handle authentication requirement when setup is completed', async () => {
      // Set up completed scenario
      await env.DB.prepare('INSERT INTO Config (key, value, type) VALUES (?, ?, ?)').bind(
        'app.setup_completed', 'true', 'boolean'
      ).run();
      await env.DB.prepare('INSERT INTO Config (key, value, type) VALUES (?, ?, ?)').bind(
        'app.config_password', 'TestPass123!', 'string'
      ).run();
      await ConfigService.refreshCache();
      
      // Request without authentication should return 401
      const apiRequest = new Request('http://localhost/api/v1/setup');
      const apiResponse = await app.fetch(apiRequest, env);
      expect(apiResponse.status).toBe(401);
      
      // Request with correct authentication should return 200
      const authRequest = new Request('http://localhost/api/v1/setup', {
        headers: {
          'Authorization': 'Bearer TestPass123!'
        }
      });
      const authResponse = await app.fetch(authRequest, env);
      expect(authResponse.status).toBe(200);
    });
  });

  describe('Page Redirection Logic', () => {
    it('should redirect from root to setup when not configured', async () => {
      // No setup configured (cleared in beforeEach)
      
      const request = new Request('http://localhost/', { redirect: 'manual' });
      const response = await app.fetch(request, env);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/setup');
    });

    it('should redirect from root to playground when configured', async () => {
      // Set setup as completed
      await env.DB.prepare('INSERT INTO Config (key, value, type) VALUES (?, ?, ?)').bind(
        'app.setup_completed', 'true', 'boolean'
      ).run();
      await ConfigService.refreshCache();
      
      const request = new Request('http://localhost/', { redirect: 'manual' });
      const response = await app.fetch(request, env);
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/playground');
    });
  });
});