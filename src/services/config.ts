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
    
    for (const config of configs as Config[]) {
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

    const updated = result[0] as Config;
    
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
   * Get dynamic description for a config key
   */
  private static getConfigDescription(key: string): string {
    // Dynamic descriptions based on key patterns
    const descriptions: Record<string, string> = {
      // Google services
      'google.client_id': 'Google OAuth Client ID',
      'google.client_secret': 'Google OAuth Client Secret',
      'google.sheetId': 'Selected Google Sheet ID',
      
      // Auth0 services
      'auth0.domain': 'Auth0 Domain',
      'auth0.client_id': 'Auth0 Client ID',
      'auth0.client_secret': 'Auth0 Client Secret',
      
      // Application settings
      'app.config_password': 'Configuration Password',
      'app.setup_completed': 'Setup completion status',
      
      // Storage settings
      'storage.type': 'File storage type',
      'storage.r2.bucket': 'R2 bucket name',
      'storage.r2.accessKeyId': 'R2 access key ID',
      'storage.r2.secretAccessKey': 'R2 secret access key',
      'storage.r2.endpoint': 'R2 endpoint URL',
      'storage.gdrive.folderId': 'Google Drive folder ID'
    };

    // Return specific description or generate one based on key pattern
    if (descriptions[key]) {
      return descriptions[key];
    }

    // Generate description from key pattern
    const parts = key.split('.');
    if (parts.length >= 2) {
      const service = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const setting = parts.slice(1).join(' ').replace(/([A-Z])/g, ' $1').toLowerCase();
      return `${service} ${setting}`;
    }

    return `Configuration setting: ${key}`;
  }

  /**
   * Validate configs input structure
   */
  private static validateConfigs(configs: unknown): asserts configs is Record<string, { value: string; type?: ConfigType }> {
    if (!configs || typeof configs !== 'object') {
      throw new Error('Configs must be a non-empty object');
    }

    const configsObj = configs as Record<string, unknown>;
    const entries = Object.entries(configsObj);
    
    if (entries.length === 0) {
      throw new Error('Configs object cannot be empty');
    }

    for (const [key, config] of entries) {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        throw new Error('Config keys must be non-empty strings');
      }

      if (!config || typeof config !== 'object') {
        throw new Error(`Config for key "${key}" must be an object`);
      }

      const configObj = config as Record<string, unknown>;
      
      if (typeof configObj.value !== 'string') {
        throw new Error(`Config value for key "${key}" must be a string`);
      }

      if (configObj.type !== undefined) {
        const validTypes: ConfigType[] = ['string', 'number', 'boolean', 'json'];
        if (!validTypes.includes(configObj.type as ConfigType)) {
          throw new Error(`Config type for key "${key}" must be one of: ${validTypes.join(', ')}`);
        }
      }
    }
  }

  /**
   * Set multiple config values at once with validation and transaction support
   */
  static async setAll(configs: Record<string, { value: string; type?: ConfigType }>): Promise<void> {
    this.ensureInitialized();
    
    if (!this.db) {
      throw new Error('ConfigService database connection missing');
    }

    // Validate input
    this.validateConfigs(configs);

    const configEntries = Object.entries(configs);

    try {
      // Use Drizzle transaction for atomicity
      await this.db.transaction(async (tx) => {
        const now = new Date().toISOString();
        
        for (const [key, config] of configEntries) {
          const description = this.getConfigDescription(key);
          const type = config.type || 'string';
          
          // Perform upsert within transaction
          const existing = await tx.select().from(configTable).where(eq(configTable.key, key)).limit(1);
          
          if (existing.length > 0) {
            // Update existing
            await tx.update(configTable)
              .set({
                value: config.value,
                type: type,
                description: description,
                updated_at: now
              })
              .where(eq(configTable.key, key));
          } else {
            // Insert new
            await tx.insert(configTable).values({
              key: key,
              value: config.value,
              type: type,
              description: description
            });
          }
        }
      });

      // Update cache after successful transaction
      await this.refreshCache();
      
    } catch (error) {
      throw new Error(`Failed to update configs: ${error instanceof Error ? error.message : String(error)}`);
    }
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