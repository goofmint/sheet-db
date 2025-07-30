import { eq } from 'drizzle-orm';
import { configTable, type Config, type ConfigInsert, type ConfigType } from '../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload } from './types';
import { ConfigDescriptions } from './descriptions';

/**
 * Database operations for configuration management
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

  /**
   * Load all configurations from database
   */
  static async loadAll(): Promise<Config[]> {
    const db = this.getDatabase();
    return await db.select().from(configTable) as Config[];
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

  /**
   * Set multiple configurations with transaction support
   */
  static async setAll(configs: ConfigUpdatePayload): Promise<void> {
    const db = this.getDatabase();
    const configEntries = Object.entries(configs);

    try {
      // Try to use Drizzle transaction for atomicity
      const useTransaction = typeof db.transaction === 'function';
      
      if (useTransaction) {
        try {
          await db.transaction(async (tx) => {
            await this.performBulkUpsert(tx, configEntries);
          });
        } catch (transactionError) {
          // If transaction fails, fall back to individual operations
          await this.performBulkUpsertFallback(configEntries);
        }
      } else {
        // Environment doesn't support transactions, use fallback
        await this.performBulkUpsertFallback(configEntries);
      }
    } catch (error) {
      throw new Error(`Failed to update configs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform bulk upsert within a transaction
   */
  private static async performBulkUpsert(
    tx: any, // Transaction type is not exported by drizzle
    configEntries: Array<[string, { value: string; type?: ConfigType }]>
  ): Promise<void> {
    const now = new Date().toISOString();
    
    for (const [key, config] of configEntries) {
      const description = ConfigDescriptions.getDescription(key);
      const type = config.type || 'string';
      
      // Check if config exists
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
  }

  /**
   * Fallback method for environments that don't support transactions
   */
  private static async performBulkUpsertFallback(
    configEntries: Array<[string, { value: string; type?: ConfigType }]>
  ): Promise<void> {
    for (const [key, config] of configEntries) {
      const description = ConfigDescriptions.getDescription(key);
      const type = config.type || 'string';
      
      await this.upsert(key, config.value, type, description);
    }
  }
}