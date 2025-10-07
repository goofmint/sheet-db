/**
 * Integration tests for Google credentials configuration
 *
 * Tests saving and retrieving Google OAuth2 credentials from D1 config table
 * Uses real D1 database (no mocking)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { getTestEnv, cleanupTestEnv } from '../../helpers/test-app';
import { ConfigRepository } from '../../../src/db/config.repository';
import type { Env } from '../../../src/types/env';

describe('Google Credentials Configuration', () => {
  let env: Env;
  let configRepo: ConfigRepository;

  afterAll(async () => {
    await cleanupTestEnv();
  });

  beforeEach(async () => {
    env = await getTestEnv();
    configRepo = new ConfigRepository(env);

    // Clear config table before each test
    const db = (configRepo as { db: { delete: (table: unknown) => { execute: () => Promise<unknown> } } }).db;
    const { config: configSchema } = await import('../../../src/db/schema');
    await db.delete(configSchema).execute();
  });

  describe('Save and Retrieve Credentials', () => {
    it('should save Google OAuth2 credentials', async () => {
      const credentials = {
        clientId: 'test-client-id.apps.googleusercontent.com',
        clientSecret: 'GOCSPX-test-secret',
        redirectUri: 'http://localhost:8787/api/setup/google-callback',
      };

      await configRepo.saveGoogleCredentials(credentials);

      // Verify credentials were saved
      const saved = await configRepo.getGoogleCredentials();
      expect(saved).not.toBeNull();
      expect(saved?.clientId).toBe(credentials.clientId);
      expect(saved?.clientSecret).toBe(credentials.clientSecret);
      expect(saved?.redirectUri).toBe(credentials.redirectUri);
    });

    it('should encrypt client secret', async () => {
      const credentials = {
        clientId: 'test-client-id',
        clientSecret: 'plain-text-secret',
        redirectUri: 'http://localhost:8787/callback',
      };

      await configRepo.saveGoogleCredentials(credentials);

      // Get raw value from config (should be encrypted)
      const rawSecret = await configRepo.get('google_client_secret');
      expect(rawSecret).not.toBeNull();
      expect(rawSecret).not.toBe('plain-text-secret');

      // Get decrypted value (should match original)
      const decrypted = await configRepo.getDecrypted('google_client_secret');
      expect(decrypted).toBe('plain-text-secret');
    });

    it('should return null when credentials are not configured', async () => {
      const credentials = await configRepo.getGoogleCredentials();
      expect(credentials).toBeNull();
    });

    it('should update credentials when called multiple times', async () => {
      const credentials1 = {
        clientId: 'client-1',
        clientSecret: 'secret-1',
        redirectUri: 'http://localhost:8787/callback',
      };

      const credentials2 = {
        clientId: 'client-2',
        clientSecret: 'secret-2',
        redirectUri: 'http://localhost:8787/callback',
      };

      await configRepo.saveGoogleCredentials(credentials1);
      let saved = await configRepo.getGoogleCredentials();
      expect(saved?.clientId).toBe('client-1');

      await configRepo.saveGoogleCredentials(credentials2);
      saved = await configRepo.getGoogleCredentials();
      expect(saved?.clientId).toBe('client-2');
      expect(saved?.clientSecret).toBe('secret-2');
    });
  });

  describe('Save and Retrieve Tokens', () => {
    it('should save Google OAuth tokens', async () => {
      const tokens = {
        accessToken: 'ya29.a0AfH6SMBx...',
        refreshToken: '1//0gK1X2Y3Z...',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      await configRepo.saveGoogleTokens(tokens);

      // Verify tokens were saved
      const accessToken = await configRepo.getGoogleAccessToken();
      const refreshToken = await configRepo.getGoogleRefreshToken();

      expect(accessToken).toBe(tokens.accessToken);
      expect(refreshToken).toBe(tokens.refreshToken);
    });

    it('should encrypt tokens', async () => {
      const tokens = {
        accessToken: 'plain-access-token',
        refreshToken: 'plain-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      await configRepo.saveGoogleTokens(tokens);

      // Get raw values (should be encrypted)
      const rawAccess = await configRepo.get('google_access_token');
      const rawRefresh = await configRepo.get('google_refresh_token');

      expect(rawAccess).not.toBe('plain-access-token');
      expect(rawRefresh).not.toBe('plain-refresh-token');

      // Get decrypted values (should match original)
      const decryptedAccess = await configRepo.getGoogleAccessToken();
      const decryptedRefresh = await configRepo.getGoogleRefreshToken();

      expect(decryptedAccess).toBe('plain-access-token');
      expect(decryptedRefresh).toBe('plain-refresh-token');
    });
  });

  describe('Sheet Configuration', () => {
    it('should save sheet configuration', async () => {
      await configRepo.saveSheetConfig('sheet-id-123', 'My Spreadsheet');

      const sheetId = await configRepo.getSelectedSheetId();
      expect(sheetId).toBe('sheet-id-123');
    });
  });

  describe('File Storage Configuration', () => {
    it('should save Google Drive configuration', async () => {
      const config = {
        type: 'google_drive' as const,
        googleDriveFolderId: 'folder-id-abc',
      };

      await configRepo.saveFileStorageConfig(config);

      const type = await configRepo.get('file_storage_type');
      const folderId = await configRepo.get('google_drive_folder_id');

      expect(type).toBe('google_drive');
      expect(folderId).toBe('folder-id-abc');
    });

    it('should save R2 configuration with encryption', async () => {
      const config = {
        type: 'r2' as const,
        r2Config: {
          bucketName: 'my-bucket',
          accountId: 'account-123',
          accessKeyId: 'access-key-456',
          secretAccessKey: 'secret-key-789',
        },
      };

      await configRepo.saveFileStorageConfig(config);

      const type = await configRepo.get('file_storage_type');
      expect(type).toBe('r2');

      // R2 credentials should be encrypted
      const rawAccessKey = await configRepo.get('r2_access_key_id');
      expect(rawAccessKey).not.toBe('access-key-456');

      const decryptedAccessKey = await configRepo.getDecrypted('r2_access_key_id');
      expect(decryptedAccessKey).toBe('access-key-456');
    });
  });

  describe('Master Key', () => {
    it('should save and retrieve master key', async () => {
      const masterKey = 'my-super-secret-master-key';

      await configRepo.saveMasterKey(masterKey);

      const retrieved = await configRepo.getMasterKey();
      expect(retrieved).toBe(masterKey);
    });

    it('should encrypt master key', async () => {
      const masterKey = 'plain-master-key';

      await configRepo.saveMasterKey(masterKey);

      // Get raw value (should be encrypted)
      const raw = await configRepo.get('master_key');
      expect(raw).not.toBe('plain-master-key');

      // Get decrypted value (should match original)
      const decrypted = await configRepo.getMasterKey();
      expect(decrypted).toBe('plain-master-key');
    });
  });

  describe('Setup Completion Flag', () => {
    it('should mark setup as completed', async () => {
      let isComplete = await configRepo.isSetupComplete();
      expect(isComplete).toBe(false);

      await configRepo.markSetupCompleted();

      isComplete = await configRepo.isSetupComplete();
      expect(isComplete).toBe(true);
    });
  });
});
