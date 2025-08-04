import { eq } from 'drizzle-orm';
import { configTable, type Config, type ConfigInsert, type ConfigType } from '../../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload } from '../types';
import { ConfigDescriptions } from '../descriptions';
import { ConfigDatabaseQuery } from './query';
import { ConfigDatabaseBulk } from './bulk';

/**
 * Database operations for configuration management
 * Acts as a facade combining core CRUD operations, bulk operations, and query operations
 */
export class ConfigDatabase {
  private static db: ConfigServiceDatabase | null = null;

  /**
   * Initialize database connection
   */
  static initialize(database: ConfigServiceDatabase): void {
    this.db = database;
  }

  /**
   * Get database instance
   */
  static getDatabase(): ConfigServiceDatabase {
    if (!this.db) {
      throw new Error('ConfigDatabase not initialized: database connection missing');
    }
    return this.db;
  }

  // ========================================
  // Core CRUD Operations
  // ========================================

  /**
   * Load all configurations from database
   */
  static async loadAll(): Promise<Config[]> {
    const db = this.getDatabase();
    return await db.select().from(configTable) as Config[];
  }

  /**
   * Find configuration by key
   */
  static async findByKey(key: string): Promise<Config | null> {
    const db = this.getDatabase();
    const result = await db.select().from(configTable).where(eq(configTable.key, key)).limit(1);
    return result.length > 0 ? result[0] as Config : null;
  }

  /**
   * Create a new configuration entry
   * Throws error if key already exists
   */
  static async create(data: {
    key: string;
    value: string;
    type: ConfigType;
    description?: string;
    system_config?: number;
    validation?: string;
  }): Promise<Config> {
    const db = this.getDatabase();

    const insertData: ConfigInsert = {
      key: data.key,
      value: data.value,
      type: data.type,
      description: data.description || ConfigDescriptions.getDescription(data.key),
      system_config: data.system_config,
      validation: data.validation
    };

    const result = await db
      .insert(configTable)
      .values(insertData)
      .returning();

    return result[0] as Config;
  }

  /**
   * Upsert a single configuration
   */
  static async upsert(key: string, value: string, type: ConfigType = 'string', description?: string): Promise<Config> {
    const db = this.getDatabase();

    const insertData: ConfigInsert = {
      key,
      value,
      type,
      description: description || ConfigDescriptions.getDescription(key)
    };

    const result = await db
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

    return result[0] as Config;
  }

  /**
   * Update an existing configuration entry
   * Returns null if key doesn't exist
   */
  static async update(key: string, data: {
    value: string;
    type: ConfigType;
    description?: string;
    system_config?: number;
    validation?: string;
  }): Promise<Config | null> {
    const db = this.getDatabase();

    const updateData = {
      value: data.value,
      type: data.type,
      description: data.description,
      system_config: data.system_config,
      validation: data.validation,
      updated_at: new Date().toISOString()
    };

    const result = await db
      .update(configTable)
      .set(updateData)
      .where(eq(configTable.key, key))
      .returning();

    return result.length > 0 ? result[0] as Config : null;
  }

  /**
   * Delete configuration by key
   */
  static async delete(key: string): Promise<boolean> {
    const db = this.getDatabase();

    const result = await db
      .delete(configTable)
      .where(eq(configTable.key, key))
      .returning();

    return result.length > 0;
  }

  /**
   * Clear all configurations
   */
  static async clear(): Promise<void> {
    const db = this.getDatabase();
    await db.delete(configTable);
  }

  // ========================================
  // Bulk Operations (delegated to ConfigDatabaseBulk)
  // ========================================

  /**
   * Set multiple configurations with transaction support
   */
  static async setAll(configs: ConfigUpdatePayload): Promise<void> {
    const db = this.getDatabase();
    return ConfigDatabaseBulk.setAll(db, configs);
  }

  // ========================================
  // Query Operations (delegated to ConfigDatabaseQuery)
  // ========================================

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
    const db = this.getDatabase();
    return ConfigDatabaseQuery.getConfigsList(db, params);
  }
}

// Re-export specialized classes for direct access if needed
export { ConfigDatabaseQuery } from './query';
export { ConfigDatabaseBulk } from './bulk';