import type { Config, ConfigType } from '../../../db/schema';
import type { ConfigUpdatePayload } from '../types';
import { ConfigCache } from '../cache';
import { ConfigDatabase } from '../database';
import { ConfigValidator } from '../validation';
import { ConfigInitializer } from '../initializer';
import { ConfigReader } from './read';

/**
 * Write operations for configuration management
 * Handles creating, updating, and deleting configuration entries
 */
export class ConfigWriter {
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
    ConfigInitializer.ensureInitialized();
    
    // Check if key already exists
    if (ConfigReader.has(params.key)) {
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
    ConfigInitializer.ensureInitialized();
    
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
    ConfigInitializer.ensureInitialized();
    
    // Check if key exists
    if (!ConfigReader.has(key)) {
      throw new Error('NOT_FOUND');
    }
    
    // Convert value to string based on type
    let stringValue: string;
    if (params.type === 'json') {
      stringValue = JSON.stringify(params.value);
    } else {
      // For all other types including boolean, just convert to string
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
    ConfigInitializer.ensureInitialized();
    
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
    ConfigInitializer.ensureInitialized();
    
    // Validate input
    ConfigValidator.validateUpdatePayload(configs);

    // Perform database operations
    await ConfigDatabase.setAll(configs);

    // Update cache after successful operations
    await ConfigInitializer.refreshCache();
  }

  /**
   * Clear all config (async - clears both DB and cache)
   * WARNING: This will delete all configuration data
   */
  static async clear(): Promise<void> {
    ConfigInitializer.ensureInitialized();
    
    await ConfigDatabase.clear();
    ConfigCache.clear();
  }
}