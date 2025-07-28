import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../../../../../src/services/config';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { configTable } from '../../../../../src/db/schema';
import { setupConfigDatabase } from '../../../../utils/database-setup';
import app from '../../../../../src';

describe('Login API - GET /api/v1/auth/login', () => {
  const db = drizzle(env.DB);
  
  // Store original config values for restoration
  let originalAuth0Domain: string;
  let originalAuth0ClientId: string;
  let originalAllowedRedirectBases: string;

  beforeAll(async () => {
    // Ensure required environment variables are set
    if (!env.AUTH0_DOMAIN) {
      throw new Error('AUTH0_DOMAIN environment variable is required for tests');
    }
    if (!env.AUTH0_CLIENT_ID) {
      throw new Error('AUTH0_CLIENT_ID environment variable is required for tests');
    }
    if (!env.AUTH0_CLIENT_SECRET) {
      throw new Error('AUTH0_CLIENT_SECRET environment variable is required for tests');
    }

    // Setup test database
    await setupConfigDatabase(db);
    
    // Initialize ConfigService
    await ConfigService.initialize(db);
    
    // Store original values for restoration
    originalAuth0Domain = env.AUTH0_DOMAIN;
    originalAuth0ClientId = env.AUTH0_CLIENT_ID;
    originalAllowedRedirectBases = JSON.stringify([
      'http://localhost:8787',
      'https://test.example.com'
    ]);
    
    // Save Auth0 configuration using ConfigService with correct keys
    await ConfigService.upsert('auth0.domain', originalAuth0Domain, 'string');
    await ConfigService.upsert('auth0.client_id', originalAuth0ClientId, 'string');
    await ConfigService.upsert('auth0.client_secret', env.AUTH0_CLIENT_SECRET, 'string');
    await ConfigService.upsert('allowedRedirectBases', originalAllowedRedirectBases, 'json');
  });

  // Ensure clean state after each test that might modify config
  afterEach(async () => {
    // Restore original configuration after each test
    await ConfigService.upsert('auth0.domain', originalAuth0Domain, 'string');
    await ConfigService.upsert('auth0.client_id', originalAuth0ClientId, 'string');
    await ConfigService.upsert('auth0.client_secret', env.AUTH0_CLIENT_SECRET, 'string');
    await ConfigService.upsert('allowedRedirectBases', originalAllowedRedirectBases, 'json');
  });

  afterAll(async () => {
    // Clean up test data using ConfigService
    await ConfigService.deleteByKey('auth0.domain');
    await ConfigService.deleteByKey('auth0.client_id');
    await ConfigService.deleteByKey('auth0.client_secret');
    await ConfigService.deleteByKey('allowedRedirectBases');
  });

  describe('Successful login redirect', () => {
    it('should redirect to Auth0 with proper parameters', async () => {
      const response = await app.fetch(new Request('http://localhost:8787/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'localhost:8787'
        }
      }), env);

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();
      expect(location).toContain(`https://${env.AUTH0_DOMAIN}/authorize`);
      expect(location).toContain(`client_id=${env.AUTH0_CLIENT_ID}`);
      expect(location).toContain('response_type=code');
      expect(location).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fv1%2Fauth%2Fcallback');
      expect(location).toContain('state=');
      expect(location).toContain('scope=openid+profile+email');
      
      // Check state cookie was set
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('auth_state=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Max-Age=600');
    });

    it('should use https redirect URI for https origin', async () => {
      const response = await app.fetch(new Request('https://test.example.com/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'test.example.com'
        }
      }), env);

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('redirect_uri=https%3A%2F%2Ftest.example.com%2Fapi%2Fv1%2Fauth%2Fcallback');
      
      // Check Secure flag is set for https
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('Domain=test.example.com');
    });
  });

  describe('Error handling', () => {
    it('should return 400 for unauthorized redirect base URL', async () => {
      const response = await app.fetch(new Request('http://unauthorized.com/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'unauthorized.com'
        }
      }), env);

      expect(response.status).toBe(400);
      
      const body = await response.json() as { error: string; message: string };
      expect(body.error).toBe('Unauthorized redirect base URL');
      expect(body.message).toContain('unauthorized.com');
    });

    it('should return 500 when Auth0 is not configured', async () => {
      // Temporarily remove Auth0 configuration using ConfigService
      await ConfigService.deleteByKey('auth0.domain');

      const response = await app.fetch(new Request('http://localhost:8787/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'localhost:8787'
        }
      }), env);

      expect(response.status).toBe(500);
      
      const body = await response.json() as { error: string; message: string };
      expect(body.error).toBe('Authentication failed');
      expect(body.message).toBe('Authentication service not configured');
      
      // Configuration will be restored by afterEach hook
    });
  });

  describe('Security', () => {
    it('should generate unique state for each request', async () => {
      const response1 = await app.fetch(new Request('http://localhost:8787/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'localhost:8787'
        }
      }), env);

      const response2 = await app.fetch(new Request('http://localhost:8787/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'localhost:8787'
        }
      }), env);

      const location1 = response1.headers.get('Location')!;
      const location2 = response2.headers.get('Location')!;

      // Extract state parameters
      const state1 = new URL(location1).searchParams.get('state');
      const state2 = new URL(location2).searchParams.get('state');

      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
    });

    it('should use httpOnly cookies with proper settings', async () => {
      const response = await app.fetch(new Request('http://localhost:8787/api/v1/auth/login', {
        method: 'GET',
        headers: {
          'Host': 'localhost:8787'
        }
      }), env);

      const setCookie = response.headers.get('Set-Cookie')!;
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Domain=localhost');
      expect(setCookie).not.toContain('Secure'); // Not secure for http
    });
  });
});