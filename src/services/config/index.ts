import type { Config, ConfigType } from '../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload } from './types';
import { ConfigInitializer } from './initializer';
import { ConfigReader } from './operations/read';
import { ConfigWriter } from './operations/write';
import { ConfigQuery } from './operations/query';

/**
 * ConfigService provides fast, memory-cached access to application configuration
 * All config data is loaded into memory at startup for synchronous access
 */
export class ConfigService {
  // ========================================
  // Initialization Operations
  // ========================================

  /**
   * Initialize the ConfigService with database connection
   * Must be called at application startup
   */
  static async initialize(database: ConfigServiceDatabase): Promise<void> {
    return ConfigInitializer.initialize(database);
  }

  /**
   * Refresh cache from database
   * Loads all config entries into memory
   */
  static async refreshCache(): Promise<void> {
    return ConfigInitializer.refreshCache();
  }

  /**
   * Check if ConfigService is initialized
   */
  static isInitialized(): boolean {
    return ConfigInitializer.isInitialized();
  }

  // ========================================
  // Read Operations (delegated to ConfigReader)
  // ========================================

  /**
   * Get config entry by key (synchronous)
   */
  static findByKey(key: string): Config | null {
    return ConfigReader.findByKey(key);
  }

  /**
   * Check if config key exists (synchronous)
   */
  static has(key: string): boolean {
    return ConfigReader.has(key);
  }

  /**
   * Get config value with optional default (synchronous)
   */
  static get(key: string, defaultValue?: string): string | null {
    return ConfigReader.get(key, defaultValue);
  }

  /**
   * Get string config value with optional default (synchronous)
   */
  static getString(key: string, defaultValue = ''): string {
    return ConfigReader.getString(key, defaultValue);
  }

  /**
   * Get number config value with optional default (synchronous)
   */
  static getNumber(key: string, defaultValue = 0): number {
    return ConfigReader.getNumber(key, defaultValue);
  }

  /**
   * Get boolean config value with optional default (synchronous)
   */
  static getBoolean(key: string, defaultValue = false): boolean {
    return ConfigReader.getBoolean(key, defaultValue);
  }

  /**
   * Get JSON config value with optional default (synchronous)
   */
  static getJson<T>(key: string, defaultValue?: T): T {
    return ConfigReader.getJson<T>(key, defaultValue);
  }

  /**
   * Get all config keys (synchronous)
   */
  static keys(): string[] {
    return ConfigReader.keys();
  }

  /**
   * Get all config entries as key-value pairs (synchronous)
   */
  static getAll(): Record<string, string> {
    return ConfigReader.getAll();
  }

  /**
   * Get config type (synchronous)
   */
  static getType(key: string): string {
    return ConfigReader.getType(key);
  }

  /**
   * Get config cache size (synchronous)
   */
  static size(): number {
    return ConfigReader.size();
  }

  // ========================================
  // Write Operations (delegated to ConfigWriter)
  // ========================================

  /**
   * Create new config entry (async - creates in DB and updates cache)
   * Throws error if key already exists
   */
  static async createConfig(params: {
    key: string;
    value: string | number | boolean | object;
    type: ConfigType;
    description?: string;
    system_config?: boolean;
    validation?: string;
  }): Promise<Config> {
    return ConfigWriter.createConfig(params);
  }

  /**
   * Upsert config value (async - updates both DB and cache)
   */
  static async upsert(key: string, value: string, type: ConfigType = 'string', description?: string): Promise<Config> {
    return ConfigWriter.upsert(key, value, type, description);
  }

  /**
   * Update existing config entry (async - updates DB and cache)
   * Throws error if key doesn't exist
   */
  static async updateConfig(key: string, params: {
    value: string | number | boolean | object;
    type: ConfigType;
    description?: string;
    system_config?: boolean;
    validation?: string;
  }): Promise<Config> {
    return ConfigWriter.updateConfig(key, params);
  }

  /**
   * Delete config by key (async - updates both DB and cache)
   */
  static async deleteByKey(key: string): Promise<boolean> {
    return ConfigWriter.deleteByKey(key);
  }

  /**
   * Set multiple config values at once with validation and transaction support
   */
  static async setAll(configs: ConfigUpdatePayload): Promise<void> {
    return ConfigWriter.setAll(configs);
  }

  /**
   * Clear all config (async - clears both DB and cache)
   * WARNING: This will delete all configuration data
   */
  static async clear(): Promise<void> {
    return ConfigWriter.clear();
  }

  // ========================================
  // Query Operations (delegated to ConfigQuery)
  // ========================================

  /**
   * Get description for a config key
   */
  static getDescription(key: string): string {
    return ConfigQuery.getDescription(key);
  }

  /**
   * Check if a config key is sensitive
   */
  static isSensitive(key: string): boolean {
    return ConfigQuery.isSensitive(key);
  }

  /**
   * Get configuration list with pagination, search, and filtering
   */
  static async getConfigsList(params: {
    page: number;
    limit: number;
    search: string;
    type?: ConfigType;
    system?: boolean;
    sort: 'key' | 'type' | 'created_at' | 'updated_at';
    order: 'asc' | 'desc';
  }): Promise<{
    configs: Config[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    return ConfigQuery.getConfigsList(params);
  }
}

// Re-export types and utilities for convenience
export type { ConfigUpdatePayload } from './types';
export { ConfigDescriptions } from './descriptions';
export { ConfigValidator } from './validation';
export { ConfigCache } from './cache';
export { ConfigDatabase } from './database';
export { ConfigInitializer } from './initializer';
export { ConfigReader } from './operations/read';
export { ConfigWriter } from './operations/write';
export { ConfigQuery } from './operations/query';