import { eq } from 'drizzle-orm';
import { 
  configTable, 
  type Config, 
  type ConfigInsert, 
  type ConfigType 
} from '../db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * ConfigService provides fast, memory-cached access to application configuration
 * All config data is loaded into memory at startup for synchronous access
 */
export class ConfigService {
  private static configCache = new Map<string, Config>();
  private static initialized = false;
  private static db: DrizzleD1Database | null = null;

  /**
   * Initialize the ConfigService with database connection
   * Must be called at application startup
   */
  static async initialize(database: DrizzleD1Database): Promise<void> {
    this.db = database;
    await this.refreshCache();
    this.initialized = true;
  }

  /**
   * Refresh cache from database
   * Loads all config entries into memory
   */
  static async refreshCache(): Promise<void> {
    if (!this.db) {
      throw new Error('ConfigService not initialized: database connection missing');
    }

    const configs = await this.db.select().from(configTable);
    this.configCache.clear();
    
    for (const config of configs) {
      this.configCache.set(config.key, config);
    }
  }

  /**
   * Check if ConfigService is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset ConfigService state (for testing)
   */
  static reset(): void {
    this.configCache.clear();
    this.initialized = false;
    this.db = null;
  }

  /**
   * Get config entry by key (synchronous)
   */
  static findByKey(key: string): Config | null {
    this.ensureInitialized();
    return this.configCache.get(key) || null;
  }

  /**
   * Check if config key exists (synchronous)
   */
  static has(key: string): boolean {
    this.ensureInitialized();
    return this.configCache.has(key);
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
    return Array.from(this.configCache.keys());
  }

  /**
   * Get config cache size (synchronous)
   */
  static size(): number {
    this.ensureInitialized();
    return this.configCache.size;
  }

  /**
   * Upsert config value (async - updates both DB and cache)
   */
  static async upsert(key: string, value: string, type: ConfigType = 'string', description?: string): Promise<Config> {
    this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('ConfigService database connection missing');
    }

    const insertData: ConfigInsert = {
      key,
      value,
      type,
      description
    };

    // Upsert in database
    const result = await this.db
      .insert(configTable)
      .values(insertData)
      .onConflictDoUpdate({
        target: configTable.key,
        set: {
          value: insertData.value,
          type: insertData.type,
          description: insertData.description,
          updated_at: new Date().toISOString()
        }
      })
      .returning();

    const updated = result[0];
    
    // Update cache
    this.configCache.set(key, updated);
    
    return updated;
  }

  /**
   * Delete config by key (async - updates both DB and cache)
   */
  static async deleteByKey(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('ConfigService database connection missing');
    }

    const result = await this.db
      .delete(configTable)
      .where(eq(configTable.key, key))
      .returning();

    if (result.length > 0) {
      this.configCache.delete(key);
      return true;
    }
    
    return false;
  }

  /**
   * Clear all config (async - clears both DB and cache)
   * WARNING: This will delete all configuration data
   */
  static async clear(): Promise<void> {
    this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('ConfigService database connection missing');
    }

    await this.db.delete(configTable);
    this.configCache.clear();
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