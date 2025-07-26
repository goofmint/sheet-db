import { eq } from 'drizzle-orm';
import { AbstractBaseRepository } from './base';
import { 
  configTable, 
  type Config, 
  type ConfigInsert, 
  type ConfigUpdate 
} from '../db/schema';
import { ConfigService } from '../services/config';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Config Repository - delegates most operations to ConfigService for performance
 * Database operations update both DB and ConfigService cache
 */
export class ConfigRepository extends AbstractBaseRepository<Config, ConfigInsert, ConfigUpdate> {
  
  constructor(database: DrizzleD1Database) {
    super(database);
  }

  /**
   * Find config by ID (synchronous via ConfigService cache)
   */
  async findById(id: number): Promise<Config | null> {
    // Since ConfigService uses key-based access, we need to query DB for ID-based lookup
    const result = await this.db
      .select()
      .from(configTable)
      .where(eq(configTable.id, id))
      .limit(1);
    
    return (result[0] as Config) || null;
  }

  /**
   * Find all configs with optional pagination
   */
  async findAll(limit = 100, offset = 0): Promise<Config[]> {
    const result = await this.db
      .select()
      .from(configTable)
      .limit(limit)
      .offset(offset);
    
    return result as Config[];
  }

  /**
   * Create new config entry
   */
  async create(data: ConfigInsert): Promise<Config> {
    // Use ConfigService.upsert to maintain cache consistency
    return await ConfigService.upsert(data.key, data.value, data.type, data.description);
  }

  /**
   * Update config by ID
   */
  async update(id: number, data: ConfigUpdate): Promise<Config | null> {
    // First get the current config to find the key
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    // Use ConfigService.upsert to maintain cache consistency
    const updatedValue = data.value ?? current.value;
    const updatedType = data.type ?? current.type;
    const updatedDescription = data.description ?? current.description ?? undefined;

    return await ConfigService.upsert(current.key, updatedValue, updatedType, updatedDescription);
  }

  /**
   * Delete config by ID
   */
  async delete(id: number): Promise<boolean> {
    // First get the current config to find the key
    const current = await this.findById(id);
    if (!current) {
      return false;
    }

    // Use ConfigService.deleteByKey to maintain cache consistency
    return await ConfigService.deleteByKey(current.key);
  }

  /**
   * Find config by key (synchronous via ConfigService)
   */
  findByKey(key: string): Config | null {
    return ConfigService.findByKey(key);
  }

  /**
   * Upsert config by key (async)
   */
  async upsertByKey(key: string, data: ConfigInsert): Promise<Config> {
    return await ConfigService.upsert(key, data.value, data.type, data.description);
  }

  /**
   * Delete config by key (async)
   */
  async deleteByKey(key: string): Promise<boolean> {
    return await ConfigService.deleteByKey(key);
  }

  /**
   * Check if config key exists (synchronous)
   */
  has(key: string): boolean {
    return ConfigService.has(key);
  }

  /**
   * Get string config value (synchronous)
   */
  getString(key: string, defaultValue?: string): string {
    return ConfigService.getString(key, defaultValue);
  }

  /**
   * Get number config value (synchronous)
   */
  getNumber(key: string, defaultValue?: number): number {
    return ConfigService.getNumber(key, defaultValue);
  }

  /**
   * Get boolean config value (synchronous)
   */
  getBoolean(key: string, defaultValue?: boolean): boolean {
    return ConfigService.getBoolean(key, defaultValue);
  }

  /**
   * Get JSON config value (synchronous)
   */
  getJson<T>(key: string, defaultValue?: T): T {
    return ConfigService.getJson<T>(key, defaultValue);
  }

  /**
   * Get all config keys (synchronous)
   */
  keys(): string[] {
    return ConfigService.keys();
  }

  /**
   * Get config cache size (synchronous)
   */
  size(): number {
    return ConfigService.size();
  }
}