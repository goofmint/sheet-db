/**
 * Configuration Repository
 *
 * Manages system configuration in D1 config table
 * Handles encryption/decryption of sensitive configuration values
 */

import { eq } from 'drizzle-orm';
import { createDbClient } from './client';
import { config } from './schema';
import type { Env } from '../types/env';
import { encrypt, decrypt } from '../utils/crypto';
import type { FileStorageConfig } from '../types/google';

export class ConfigRepository {
  private db;
  private env: Env;

  constructor(env: Env) {
    this.db = createDbClient(env);
    this.env = env;
  }

  /**
   * Gets encryption passphrase from environment
   */
  private getEncryptionKey(): string {
    const key = this.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable not set');
    }
    return key;
  }

  /**
   * Get configuration value by key
   */
  async get(key: string): Promise<string | null> {
    const result = await this.db
      .select()
      .from(config)
      .where(eq(config.key, key))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0].value;
  }

  /**
   * Get and decrypt configuration value
   */
  async getDecrypted(key: string): Promise<string | null> {
    const encrypted = await this.get(key);
    if (!encrypted) {
      return null;
    }

    try {
      return await decrypt(encrypted, this.getEncryptionKey());
    } catch (error) {
      throw new Error(
        `Failed to decrypt config key "${key}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Set configuration value
   */
  async set(key: string, value: string, description?: string): Promise<void> {
    const now = new Date();
    await this.db
      .insert(config)
      .values({
        key,
        value,
        description: description || null,
        updated_at: now,
      })
      .onConflictDoUpdate({
        target: config.key,
        set: {
          value,
          description: description || null,
          updated_at: now,
        },
      });
  }

  /**
   * Set encrypted configuration value
   */
  async setEncrypted(
    key: string,
    value: string,
    description?: string
  ): Promise<void> {
    const encrypted = await encrypt(value, this.getEncryptionKey());
    await this.set(key, encrypted, description);
  }

  /**
   * Save Google OAuth2 credentials
   */
  async saveGoogleCredentials(credentials: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<void> {
    // Execute sequentially to avoid database locks in D1
    await this.set('google_client_id', credentials.clientId, 'Google OAuth2 Client ID');
    await this.setEncrypted(
      'google_client_secret',
      credentials.clientSecret,
      'Google OAuth2 Client Secret (encrypted)'
    );
    await this.set('google_redirect_uri', credentials.redirectUri, 'Google OAuth2 Redirect URI');
  }

  /**
   * Get Google OAuth2 credentials
   */
  async getGoogleCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } | null> {
    const [clientId, clientSecret, redirectUri] = await Promise.all([
      this.get('google_client_id'),
      this.getDecrypted('google_client_secret'),
      this.get('google_redirect_uri'),
    ]);

    if (!clientId || !clientSecret || !redirectUri) {
      return null;
    }

    return { clientId, clientSecret, redirectUri };
  }

  /**
   * Save Google OAuth tokens
   */
  async saveGoogleTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<void> {
    // Execute sequentially to avoid database locks in D1
    await this.setEncrypted(
      'google_access_token',
      tokens.accessToken,
      'Google OAuth2 Access Token (encrypted)'
    );
    await this.setEncrypted(
      'google_refresh_token',
      tokens.refreshToken,
      'Google OAuth2 Refresh Token (encrypted)'
    );
    await this.set(
      'google_token_expires_at',
      tokens.expiresAt.toISOString(),
      'Google OAuth2 Token Expiry Time'
    );
  }

  /**
   * Get Google access token
   */
  async getGoogleAccessToken(): Promise<string | null> {
    return this.getDecrypted('google_access_token');
  }

  /**
   * Get Google refresh token
   */
  async getGoogleRefreshToken(): Promise<string | null> {
    return this.getDecrypted('google_refresh_token');
  }

  /**
   * Save selected sheet configuration
   */
  async saveSheetConfig(sheetId: string, sheetName: string): Promise<void> {
    // Execute sequentially to avoid database locks in D1
    await this.set('selected_sheet_id', sheetId, 'Selected Google Sheet ID');
    await this.set('selected_sheet_name', sheetName, 'Selected Google Sheet Name');
  }

  /**
   * Get selected sheet ID
   */
  async getSelectedSheetId(): Promise<string | null> {
    return this.get('selected_sheet_id');
  }

  /**
   * Save file storage configuration
   */
  async saveFileStorageConfig(storageConfig: FileStorageConfig): Promise<void> {
    await this.set(
      'file_storage_type',
      storageConfig.type,
      'File Storage Type (google_drive or r2)'
    );

    if (storageConfig.type === 'google_drive' && storageConfig.googleDriveFolderId) {
      await this.set(
        'google_drive_folder_id',
        storageConfig.googleDriveFolderId,
        'Google Drive Folder ID for file storage'
      );
    } else if (storageConfig.type === 'r2' && storageConfig.r2Config) {
      // Execute sequentially to avoid database locks in D1
      await this.set('r2_bucket_name', storageConfig.r2Config.bucketName, 'R2 Bucket Name');
      await this.set('r2_account_id', storageConfig.r2Config.accountId, 'R2 Account ID');
      await this.setEncrypted(
        'r2_access_key_id',
        storageConfig.r2Config.accessKeyId,
        'R2 Access Key ID (encrypted)'
      );
      await this.setEncrypted(
        'r2_secret_access_key',
        storageConfig.r2Config.secretAccessKey,
        'R2 Secret Access Key (encrypted)'
      );
    }
  }

  /**
   * Save master key (encrypted)
   */
  async saveMasterKey(masterKey: string): Promise<void> {
    await this.setEncrypted(
      'master_key',
      masterKey,
      'Master Key for ACL bypass (encrypted)'
    );
  }

  /**
   * Get master key (decrypted)
   */
  async getMasterKey(): Promise<string | null> {
    return this.getDecrypted('master_key');
  }

  /**
   * Mark setup as completed
   */
  async markSetupCompleted(): Promise<void> {
    await this.set('setup_completed', 'true', 'Setup completion flag');
  }

  /**
   * Check if initial setup is complete
   */
  async isSetupComplete(): Promise<boolean> {
    const value = await this.get('setup_completed');
    return value === 'true';
  }
}
