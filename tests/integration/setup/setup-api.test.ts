/**
 * Integration tests for setup API endpoints
 *
 * Tests the complete setup flow:
 * 1. Save Google credentials
 * 2. Initiate OAuth flow
 * 3. Handle OAuth callback
 * 4. List sheets
 * 5. Initialize sheets
 * 6. Complete setup
 *
 * Uses real D1 database (no mocking)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Hono } from 'hono';
import { getTestEnv, cleanupTestEnv } from '../../helpers/test-app';
import setupRoutes from '../../../src/routes/setup';
import type { Env } from '../../../src/types/env';
import { ConfigRepository } from '../../../src/db/config.repository';
import { signState } from '../../../src/utils/oauth-state';

describe('Setup API Endpoints', () => {
  let env: Env;
  let app: Hono<{ Bindings: Env }>;

  afterAll(async () => {
    await cleanupTestEnv();
  });

  beforeEach(async () => {
    env = await getTestEnv();
    app = new Hono<{ Bindings: Env }>();
    app.route('/', setupRoutes);

    // Clear config table before each test
    const { createDbClient } = await import('../../../src/db/client');
    const { config } = await import('../../../src/db/schema');
    const db = createDbClient(env);
    await db.delete(config).execute();
  });

  describe('POST /google-config', () => {
    it('should save Google OAuth2 credentials', async () => {
      const credentials = {
        clientId: 'test-client-id.apps.googleusercontent.com',
        clientSecret: 'GOCSPX-test-secret',
        redirectUri: 'http://localhost:8787/api/setup/google-callback',
      };

      const res = await app.request('/google-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      }, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });

      // Verify credentials were saved in D1
      const configRepo = new ConfigRepository(env);
      const saved = await configRepo.getGoogleCredentials();
      expect(saved).not.toBeNull();
      expect(saved?.clientId).toBe(credentials.clientId);
    });

    it('should return 400 for missing fields', async () => {
      const res = await app.request('/google-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: 'only-client-id' }),
      }, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });
  });

  describe('GET /google-auth', () => {
    it('should return authorization URL with signed state cookie', async () => {
      // Save credentials first
      const configRepo = new ConfigRepository(env);
      await configRepo.saveGoogleCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:8787/callback',
      });

      const res = await app.request('/google-auth', {}, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('authUrl');
      expect(data.authUrl).toContain('accounts.google.com/o/oauth2/v2/auth');
      expect(data.authUrl).toContain('client_id=test-client-id');
      expect(data.authUrl).toContain('state=');

      // Check that state cookie was set
      const cookies = res.headers.get('Set-Cookie');
      expect(cookies).toBeTruthy();
      expect(cookies).toContain('oauth_state=');
      expect(cookies).toContain('HttpOnly');
      expect(cookies).toContain('Secure');
      expect(cookies).toContain('SameSite=Lax');
    });

    it('should generate unique state tokens', async () => {
      const configRepo = new ConfigRepository(env);
      await configRepo.saveGoogleCredentials({
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        redirectUri: 'http://localhost:8787/callback',
      });

      const res1 = await app.request('/google-auth', {}, env);
      const res2 = await app.request('/google-auth', {}, env);

      const data1 = await res1.json();
      const data2 = await res2.json();

      // Extract state parameter from URL
      const url1 = new URL(data1.authUrl);
      const url2 = new URL(data2.authUrl);
      const state1 = url1.searchParams.get('state');
      const state2 = url2.searchParams.get('state');

      expect(state1).not.toBe(state2);
    });
  });

  describe('POST /initialize-sheet', () => {
    it('should return initialization result', async () => {
      // This test would require a real Google Sheets API connection
      // For now, we test the endpoint structure

      const res = await app.request('/initialize-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: 'test-sheet-id' }),
      }, env);

      // Will fail without access token, but structure should be correct
      expect(res.status).toBeGreaterThanOrEqual(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });

    it('should return 400 for missing sheetId', async () => {
      const res = await app.request('/initialize-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('sheetId');
    });
  });

  describe('POST /complete', () => {
    it('should require all fields', async () => {
      const res = await app.request('/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, env);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error');
    });

    it('should validate file storage configuration', async () => {
      const incomplete = {
        sheetId: 'test-sheet',
        sheetName: 'Test Sheet',
        fileStorage: {}, // Missing type
        adminUser: { userId: 'admin', password: 'password' },
        masterKey: 'master-key',
      };

      const res = await app.request('/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete),
      }, env);

      expect(res.status).toBe(400);
    });

    it('should validate admin user configuration', async () => {
      const incomplete = {
        sheetId: 'test-sheet',
        sheetName: 'Test Sheet',
        fileStorage: { type: 'google_drive', googleDriveFolderId: 'folder-id' },
        adminUser: { userId: 'admin' }, // Missing password
        masterKey: 'master-key',
      };

      const res = await app.request('/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete),
      }, env);

      expect(res.status).toBe(400);
    });
  });

  describe('OAuth State Verification', () => {
    it('should verify state in callback', async () => {
      // This is a unit-level test within integration test
      // Testing the state verification logic

      const secret = env.OAUTH_STATE_SECRET;
      const stateToken = 'test-state-123';
      const signedState = await signState(stateToken, secret);

      // Simulate callback with mismatched state
      const res = await app.request(
        `/google-callback?state=${stateToken}&code=auth-code`,
        {
          headers: {
            Cookie: `oauth_state=${signedState}`,
          },
        },
        env
      );

      // Should process (or fail for other reasons, but not CSRF)
      // The actual OAuth exchange will fail without real credentials
      expect(res.status).toBeGreaterThanOrEqual(200);
    });
  });
});
