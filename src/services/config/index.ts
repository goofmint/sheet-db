import type { ConfigType, Config } from '../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload } from './types';
import { ConfigCache } from './cache';
import { ConfigDatabase } from './database';
import { ConfigValidator } from './validation';
import { ConfigDescriptions } from './descriptions';

/**
 * ConfigService provides fast, memory-cached access to application configuration
 * All config data is loaded into memory at startup for synchronous access
 */
export class ConfigService {
  private static initialized = false;

  /**
   * Initialize the ConfigService with database connection
   * Must be called at application startup
   */
  static async initialize(database: ConfigServiceDatabase): Promise<void> {
    ConfigDatabase.initialize(database);
    await this.refreshCache();
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
   * Get config entry by key (synchronous)
   */
  static findByKey(key: string): Config | null {
    this.ensureInitialized();
    return ConfigCache.get(key);
  }

  /**
   * Check if config key exists (synchronous)
   */
  static has(key: string): boolean {
    this.ensureInitialized();
    return ConfigCache.has(key);
  }

  /**
   * Get string config value with optional default (synchronous)
   */
  static getString(key: string, defaultValue = ''): string {
    const config = this.findByKey(key);
    return config?.value ?? defaultValue;
  }

  /**
   * Get number config value with optional default (synchronous)
   */
  static getNumber(key: string, defaultValue = 0): number {
    const config = this.findByKey(key);
    if (!config) return defaultValue;
    
    const num = Number(config.value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * Get boolean config value with optional default (synchronous)
   */
  static getBoolean(key: string, defaultValue = false): boolean {
    const config = this.findByKey(key);
    if (!config) return defaultValue;
    
    return config.value.toLowerCase() === 'true';
  }

  /**
   * Get JSON config value with optional default (synchronous)
   */
  static getJson<T>(key: string, defaultValue?: T): T {
    const config = this.findByKey(key);
    if (!config) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Config key '${key}' not found and no default provided`);
    }
    
    try {
      return JSON.parse(config.value) as T;
    } catch (error) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Failed to parse JSON config '${key}': ${error}`);
    }
  }

  /**
   * Get all config keys (synchronous)
   */
  static keys(): string[] {
    this.ensureInitialized();
    return ConfigCache.keys();
  }

  /**
   * Get all config entries as key-value pairs (synchronous)
   */
  static getAll(): Record<string, string> {
    this.ensureInitialized();
    return ConfigCache.getAllAsRecord();
  }

  /**
   * Get config type (synchronous)
   */
  static getType(key: string): string {
    const config = this.findByKey(key);
    return config?.type || 'string';
  }

  /**
   * Get config cache size (synchronous)
   */
  static size(): number {
    this.ensureInitialized();
    return ConfigCache.size();
  }

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
    this.ensureInitialized();
    
    // Check if key already exists
    if (this.has(params.key)) {
      throw new Error('DUPLICATE_KEY');
    }
    
    // Convert value to string based on type
    let stringValue: string;
    if (params.type === 'json') {
      stringValue = JSON.stringify(params.value);
    } else {
      stringValue = String(params.value);
    }
    
    // Validate
    ConfigValidator.validateKey(params.key);
    ConfigValidator.validateValue(stringValue, params.type);
    
    // Create in database
    const created = await ConfigDatabase.create({
      key: params.key,
      value: stringValue,
      type: params.type,
      description: params.description,
      system_config: params.system_config ? 1 : 0,
      validation: params.validation
    });
    
    // Update cache
    ConfigCache.set(params.key, created);
    
    return created;
  }

  /**
   * Upsert config value (async - updates both DB and cache)
   */
  static async upsert(key: string, value: string, type: ConfigType = 'string', description?: string): Promise<Config> {
    this.ensureInitialized();
    
    ConfigValidator.validateKey(key);
    ConfigValidator.validateValue(value, type);

    const updated = await ConfigDatabase.upsert(key, value, type, description);
    
    // Update cache
    ConfigCache.set(key, updated);
    
    return updated;
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
    this.ensureInitialized();
    
    // Check if key exists
    if (!this.has(key)) {
      throw new Error('NOT_FOUND');
    }
    
    // Convert value to string based on type
    let stringValue: string;
    if (params.type === 'json') {
      stringValue = JSON.stringify(params.value);
    } else {
      stringValue = String(params.value);
    }
    
    // Validate
    ConfigValidator.validateKey(key);
    ConfigValidator.validateValue(stringValue, params.type);
    
    // Update in database
    const updated = await ConfigDatabase.update(key, {
      value: stringValue,
      type: params.type,
      description: params.description,
      system_config: params.system_config ? 1 : 0,
      validation: params.validation
    });
    
    if (!updated) {
      throw new Error('NOT_FOUND');
    }
    
    // Update cache
    ConfigCache.set(key, updated);
    
    return updated;
  }

  /**
   * Delete config by key (async - updates both DB and cache)
   */
  static async deleteByKey(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    ConfigValidator.validateKey(key);

    const deleted = await ConfigDatabase.delete(key);

    if (deleted) {
      ConfigCache.delete(key);
      return true;
    }
    
    return false;
  }

  /**
   * Set multiple config values at once with validation and transaction support
   */
  static async setAll(configs: ConfigUpdatePayload): Promise<void> {
    this.ensureInitialized();
    
    // Validate input
    ConfigValidator.validateUpdatePayload(configs);

    // Perform database operations
    await ConfigDatabase.setAll(configs);

    // Update cache after successful operations
    await this.refreshCache();
  }

  /**
   * Clear all config (async - clears both DB and cache)
   * WARNING: This will delete all configuration data
   */
  static async clear(): Promise<void> {
    this.ensureInitialized();
    
    await ConfigDatabase.clear();
    ConfigCache.clear();
  }

  /**
   * Get description for a config key
   */
  static getDescription(key: string): string {
    return ConfigDescriptions.getDescription(key);
  }

  /**
   * Check if a config key is sensitive
   */
  static isSensitive(key: string): boolean {
    return ConfigDescriptions.isSensitive(key);
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
    this.ensureInitialized();
    return await ConfigDatabase.getConfigsList(params);
  }

  /**
   * Ensure ConfigService is initialized
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ConfigService not initialized. Call ConfigService.initialize() first.');
    }
  }
}

// Re-export types and utilities for convenience
export type { ConfigUpdatePayload } from './types';
export { ConfigDescriptions } from './descriptions';
export { ConfigValidator } from './validation';
export { ConfigCache } from './cache';
export { ConfigDatabase } from './database';