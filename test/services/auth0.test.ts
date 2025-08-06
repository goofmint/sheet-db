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
    
    // Save Auth0 configuration from environment variables
    await db.insert(configTable).values([
      { key: 'auth0.domain', value: env.AUTH0_DOMAIN, type: 'string' },
      { key: 'auth0.client_id', value: env.AUTH0_CLIENT_ID, type: 'string' },
      { key: 'auth0.client_secret', value: env.AUTH0_CLIENT_SECRET, type: 'string' },
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
    await db.delete(configTable).where(eq(configTable.key, 'auth0.domain'));
    await db.delete(configTable).where(eq(configTable.key, 'auth0.client_id'));
    await db.delete(configTable).where(eq(configTable.key, 'auth0.client_secret'));
    await db.delete(configTable).where(eq(configTable.key, 'allowedRedirectBases'));
  });

  describe('getAuthorizationUrl', () => {
    it('should generate valid authorization URL', async () => {
      const state = 'test-state-123';
      const redirectUri = 'http://localhost:8787/api/auth/callback';
      
      const url = await auth0Service.getAuthorizationUrl(state, redirectUri);
      
      expect(url).toContain(`https://${env.AUTH0_DOMAIN}/authorize`);
      expect(url).toContain(`client_id=${env.AUTH0_CLIENT_ID}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(redirectUri)}`);
      expect(url).toContain(`state=${state}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+profile+email');
    });

    it('should include audience if configured', async () => {
      await db.insert(configTable).values({
        key: 'auth0.audience',
        value: 'https://api.example.com',
        type: 'string'
      });
      await ConfigService.refreshCache();
      
      const url = await auth0Service.getAuthorizationUrl('state', 'http://localhost:8787/callback');
      
      expect(url).toContain('audience=https%3A%2F%2Fapi.example.com');
      
      await db.delete(configTable).where(eq(configTable.key, 'auth0.audience'));
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
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        iss: `https://${env.AUTH0_DOMAIN}/`,
        iat: Math.floor(Date.now() / 1000) - 3600
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Token expired');
    });

    it('should reject token issued in the future', async () => {
      // Create a token issued in the future
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour in the future
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: futureTime + 3600, // Valid expiration
        iat: futureTime, // Issued in the future
        iss: `https://${env.AUTH0_DOMAIN}/`
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Token issued in the future');
    });

    it('should reject token not yet valid (nbf)', async () => {
      // Create a token that is not yet valid
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now + 3600, // Valid expiration
        iat: now - 100, // Valid issued time
        nbf: now + 600, // Not valid for another 10 minutes
        iss: `https://${env.AUTH0_DOMAIN}/`
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Token not yet valid');
    });

    it('should accept token with nbf when ignoreNotBefore is true', async () => {
      // Create a token that is not yet valid but with ignoreNotBefore option
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now + 3600,
        iat: now - 100,
        nbf: now + 600, // Not valid for another 10 minutes
        iss: `https://${env.AUTH0_DOMAIN}/`
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      // Should not throw because we ignore nbf check
      // Note: This will still fail on signature verification, but nbf validation should pass
      await expect(
        auth0Service.verifyToken(token, { ignoreNotBefore: true })
      ).rejects.toThrow('Signing key not found'); // Expected to fail on key lookup
    });

    it('should reject token with invalid issuer', async () => {
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now + 3600,
        iat: now - 100,
        iss: 'https://invalid-domain.auth0.com/' // Wrong issuer
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Invalid token issuer');
    });

    it('should accept token with custom issuer option', async () => {
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const customIssuer = 'https://custom-issuer.example.com/';
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now + 3600,
        iat: now - 100,
        iss: customIssuer
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      // Should not throw on issuer validation (will fail on key lookup)
      await expect(
        auth0Service.verifyToken(token, { issuer: customIssuer })
      ).rejects.toThrow('Signing key not found'); // Expected to fail on key lookup
    });

    it('should reject token with invalid audience', async () => {
      // First set up an audience in config
      await db.insert(configTable).values({
        key: 'auth0.audience',
        value: 'https://api.example.com',
        type: 'string'
      });
      await ConfigService.refreshCache();

      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now + 3600,
        iat: now - 100,
        iss: `https://${env.AUTH0_DOMAIN}/`,
        aud: 'https://different-api.example.com' // Wrong audience
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      await expect(
        auth0Service.verifyToken(token)
      ).rejects.toThrow('Invalid token audience');

      // Clean up
      await db.delete(configTable).where(eq(configTable.key, 'auth0.audience'));
      await ConfigService.refreshCache();
    });

    it('should respect clockTolerance for time validations', async () => {
      // Create a token that would be invalid without clock tolerance
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-kid' }));
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ 
        sub: '123',
        exp: now - 2, // Expired by 2 seconds
        iat: now - 100,
        iss: `https://${env.AUTH0_DOMAIN}/`
      }));
      const signature = 'fake-signature';
      const token = `${header}.${payload}.${signature}`;
      
      // Should be accepted with 5-second clock tolerance (will fail on key lookup)
      await expect(
        auth0Service.verifyToken(token, { clockTolerance: 5 })
      ).rejects.toThrow('Signing key not found'); // Expected to fail on key lookup, not time validation
      
      // Should be rejected with 1-second clock tolerance
      await expect(
        auth0Service.verifyToken(token, { clockTolerance: 1 })
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
      await db.delete(configTable).where(eq(configTable.key, 'auth0.domain'));
      await ConfigService.refreshCache();
      
      await expect(
        auth0Service.getAuthorizationUrl('state', 'http://localhost:8787/callback')
      ).rejects.toThrow('Auth0 configuration not found');
      
      // Restore configuration
      await db.insert(configTable).values({
        key: 'auth0.domain',
        value: env.AUTH0_DOMAIN,
        type: 'string'
      });
      await ConfigService.refreshCache();
    });
  });
});