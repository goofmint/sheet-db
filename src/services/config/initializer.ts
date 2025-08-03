import type { ConfigServiceDatabase } from './types';
import { ConfigCache } from './cache';
import { ConfigDatabase } from './database';

/**
 * Initialization handler for ConfigService
 * Manages initialization state and cache refresh
 */
export class ConfigInitializer {
  private static initialized = false;

  /**
   * Initialize the ConfigService with database connection
   * Must be called at application startup
   */
  static async initialize(database: ConfigServiceDatabase): Promise<void> {
    ConfigDatabase.initialize(database);
    await this.refreshCache();
    await this.initializeMasterKeyConfig();
    this.initialized = true;
  }

  /**
   * Refresh cache from database
   * Loads all config entries into memory
   */
  static async refreshCache(): Promise<void> {
    const configs = await ConfigDatabase.loadAll();
    ConfigCache.loadAll(configs);
  }

  /**
   * Check if ConfigService is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure ConfigService is initialized
   */
  static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ConfigService not initialized. Call ConfigService.initialize() first.');
    }
  }

  /**
   * Initialize master key configuration entries
   * Creates api.master_key_hash and api.master_key_salt if they don't exist
   */
  private static async initializeMasterKeyConfig(): Promise<void> {
    try {
      // Check if master key configuration already exists in database
      const existingHash = await ConfigDatabase.findByKey('api.master_key_hash');
      if (existingHash) {
        return; // Already initialized
      }

      // Generate initial salt
      const salt = crypto.randomUUID();
      
      // Create initial configuration entries
      await ConfigDatabase.upsert('api.master_key_hash', '', 'string', 'Master key hash for full API access');
      await ConfigDatabase.upsert('api.master_key_salt', salt, 'string', 'Salt for master key hashing');

      console.log('Master key configuration initialized');
    } catch (error) {
      console.error('Failed to initialize master key configuration:', error);
      // Don't throw error to avoid breaking application startup
    }
  }
}