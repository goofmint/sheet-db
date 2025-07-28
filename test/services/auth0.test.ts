import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService } from '../../src/services/config';
import { Auth0Service } from '../../src/services/auth0';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { configTable } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { setupConfigDatabase } from '../utils/database-setup';

describe('Auth0Service', () => {
  let auth0Service: Auth0Service;
  const db = drizzle(env.DB);
  
  beforeAll(async () => {
    // Setup test database
    await setupConfigDatabase(db);
    
    // Initialize ConfigService
    await ConfigService.initialize(db);
    
    // Save Auth0 configuration from environment variables
    const auth0Domain = env.AUTH0_DOMAIN || 'dev-wpguwz20dkay63vr.us.auth0.com';
    const auth0ClientId = env.AUTH0_CLIENT_ID || 'ZfpCzSrEg1gEsmhbT4Bi2ocZXociVEWi';
    
    await db.insert(configTable).values([
      { key: 'auth0Domain', value: auth0Domain, type: 'string' },
      { key: 'auth0ClientId', value: auth0ClientId, type: 'string' },
      { key: 'allowedRedirectBases', value: JSON.stringify([
        'http://localhost:8787',
        'https://test.example.com'
      ]), type: 'json' }
    ]);
    
    // Refresh cache after inserting data
    await ConfigService.refreshCache();
    
    auth0Service = new Auth0Service(env);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(configTable).where(eq(configTable.key, 'auth0Domain'));
    await db.delete(configTable).where(eq(configTable.key, 'auth0ClientId'));
    await db.delete(configTable).where(eq(configTable.key, 'allowedRedirectBases'));
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid authorization URL', async () => {
      const state = 'test-state-123';
      const redirectUri = 'http://localhost:8787/api/auth/callback';
      
      const url = await auth0Service.getAuthorizationUrl(state, redirectUri);
      
      const auth0Domain = env.AUTH0_DOMAIN || 'dev-wpguwz20dkay63vr.us.auth0.com';
      const auth0ClientId = env.AUTH0_CLIENT_ID || 'ZfpCzSrEg1gEsmhbT4Bi2ocZXociVEWi';
      
      expect(url).toContain(`https://${auth0Domain}/authorize`);
      expect(url).toContain(`client_id=${auth0ClientId}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+profile+email');
    });

    it('should include audience if configured', async () => {
      await db.insert(configTable).values({
        key: 'auth0Audience',
        value: 'https://api.example.com',
        type: 'string'
      });
      await ConfigService.refreshCache();
      
      const url = await auth0Service.getAuthorizationUrl('state', 'http://localhost:8787/callback');
      
      expect(url).toContain('audience=https%3A%2F%2Fapi.example.com');
      
      await db.delete(configTable).where(eq(configTable.key, 'auth0Audience'));
    });
  });

  describe('exchangeCodeForToken', () => {
    it('should handle invalid authorization code', async () => {
      const invalidCode = 'invalid-code';
      const redirectUri = 'http://localhost:8787/api/auth/callback';
      
      await expect(
        auth0Service.exchangeCodeForToken(invalidCode, redirectUri)
      ).rejects.toThrow('Auth0 token exchange failed');
    });
  });

  describe('getUserInfo', () => {
    it('should handle invalid access token', async () => {
      const invalidToken = 'invalid-token';
      
      await expect(
        auth0Service.getUserInfo(invalidToken)
      ).rejects.toThrow('Failed to get user info');
    });
  });

  describe('verifyToken', () => {
    it('should reject invalid token format', async () => {
      const invalidToken = 'not-a-jwt';
      
      await expect(
        auth0Service.verifyToken(invalidToken)
      ).rejects.toThrow('Invalid token format');
    });

    it('should reject token without kid', async () => {
      // Create a token without kid in header
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
      const payload = btoa(JSON.stringify({ sub: '123' }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Token missing kid');
    });

    it('should reject expired token', async () => {
      // Create an expired token
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const auth0Domain = env.AUTH0_DOMAIN || 'dev-wpguwz20dkay63vr.us.auth0.com';
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iss: `https://${auth0Domain}/`
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Token expired');
    });
  });

  describe('refreshAccessToken', () => {
    it('should handle invalid refresh token', async () => {
      const invalidRefreshToken = 'invalid-refresh-token';
      
      await expect(
        auth0Service.refreshAccessToken(invalidRefreshToken)
      ).rejects.toThrow('Auth0 token refresh failed');
    });
  });

  describe('Configuration validation', () => {
    it('should throw error when Auth0 configuration is missing', async () => {
      // Temporarily remove configuration
      await db.delete(configTable).where(eq(configTable.key, 'auth0Domain'));
      await ConfigService.refreshCache();
      
      await expect(
        auth0Service.getAuthorizationUrl('state', 'http://localhost:8787/callback')
      ).rejects.toThrow('Auth0 configuration not found');
      
      // Restore configuration
      const auth0Domain = env.AUTH0_DOMAIN || 'dev-wpguwz20dkay63vr.us.auth0.com';
      await db.insert(configTable).values({
        key: 'auth0Domain',
        value: auth0Domain,
        type: 'string'
      });
      await ConfigService.refreshCache();
    });
  });
});