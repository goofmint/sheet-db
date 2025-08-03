import { eq } from 'drizzle-orm';
import { configTable, type ConfigType } from '../../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload, DatabaseTransaction } from '../types';
import { ConfigDescriptions } from '../descriptions';

/**
 * Database bulk operations for configuration management
 * Handles transaction-based bulk operations and batch processing
 */
export class ConfigDatabaseBulk {
  
  /**
   * Set multiple configurations with transaction support
   */
  static async setAll(
    db: ConfigServiceDatabase,
    configs: ConfigUpdatePayload
  ): Promise<void> {
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
          await this.performBulkUpsertFallback(db, configEntries);
        }
      } else {
        // Environment doesn't support transactions, use fallback
        await this.performBulkUpsertFallback(db, configEntries);
      }
    } catch (error) {
      throw new Error(`Failed to update configs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform bulk upsert within a transaction
   */
  private static async performBulkUpsert(
    tx: DatabaseTransaction,
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
    db: ConfigServiceDatabase,
    configEntries: Array<[string, { value: string; type?: ConfigType }]>
  ): Promise<void> {
    for (const [key, config] of configEntries) {
      const description = ConfigDescriptions.getDescription(key);
      const type = config.type || 'string';
      
      // Perform individual upsert operations
      await this.performSingleUpsert(db, key, config.value, type, description);
    }
  }

  /**
   * Perform a single upsert operation
   */
  private static async performSingleUpsert(
    db: ConfigServiceDatabase,
    key: string,
    value: string,
    type: ConfigType,
    description: string
  ): Promise<void> {
    const insertData = {
      key,
      value,
      type,
      description
    };

    await db
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
      });
  }
}