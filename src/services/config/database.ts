import { eq, like, or, and, desc, asc, count } from 'drizzle-orm';
import { configTable, type Config, type ConfigInsert, type ConfigType } from '../../db/schema';
import type { ConfigServiceDatabase, ConfigUpdatePayload, DatabaseTransaction } from './types';
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
    configEntries: Array<[string, { value: string; type?: ConfigType }]>
  ): Promise<void> {
    for (const [key, config] of configEntries) {
      const description = ConfigDescriptions.getDescription(key);
      const type = config.type || 'string';
      
      await this.upsert(key, config.value, type, description);
    }
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
    const db = this.getDatabase();
    const { page, limit, search, type, system, sort, order } = params;
    const offset = (page - 1) * limit;

    // 検索条件の構築
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(configTable.key, `%${search}%`),
          like(configTable.description, `%${search}%`)
        )
      );
    }
    if (type) {
      conditions.push(eq(configTable.type, type));
    }
    if (system !== undefined) {
      conditions.push(eq(configTable.system_config, system ? 1 : 0));
    }

    // ソート列の決定
    const sortColumn = {
      'key': configTable.key,
      'type': configTable.type,
      'created_at': configTable.created_at,
      'updated_at': configTable.updated_at
    }[sort];

    // クエリの構築
    const baseQuery = db.select().from(configTable);
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const query = whereCondition 
      ? baseQuery.where(whereCondition)
          .orderBy(order === 'desc' ? desc(sortColumn) : asc(sortColumn))
          .limit(limit)
          .offset(offset)
      : baseQuery
          .orderBy(order === 'desc' ? desc(sortColumn) : asc(sortColumn))
          .limit(limit)
          .offset(offset);

    // 総件数の取得
    const baseCountQuery = db.select({ count: count() }).from(configTable);
    const countQuery = whereCondition ? baseCountQuery.where(whereCondition) : baseCountQuery;
    const [{ count: total }] = await countQuery;

    // データの取得
    const rawConfigs = await query;

    // 型を適切にキャストしてConfig[]として返す
    const configs: Config[] = rawConfigs.map(config => ({
      ...config,
      type: config.type as ConfigType
    }));

    // ページネーション情報の計算
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      configs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev
      }
    };
  }
}