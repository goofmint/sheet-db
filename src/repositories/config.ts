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
   * Create new config entry (direct DB operation)
   */
  async create(data: ConfigInsert): Promise<Config> {
    const result = await this.db
      .insert(configTable)
      .values(data)
      .returning();
    
    return result[0] as Config;
  }

  /**
   * Create new config entry with ConfigService cache integration
   */
  async createWithCache(data: ConfigInsert): Promise<Config> {
    // Use ConfigService.upsert to maintain cache consistency
    return await ConfigService.upsert(data.key, data.value, data.type, data.description);
  }

  /**
   * Update config by ID (direct DB operation)
   */
  async updateDirect(id: number, data: ConfigUpdate): Promise<Config | null> {
    const result = await this.db
      .update(configTable)
      .set(data)
      .where(eq(configTable.id, id))
      .returning();
    
    return result.length > 0 ? (result[0] as Config) : null;
  }

  /**
   * Update config by ID with ConfigService cache integration
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
   * Delete config by ID (direct DB operation)
   */
  async deleteDirect(id: number): Promise<boolean> {
    const result = await this.db
      .delete(configTable)
      .where(eq(configTable.id, id))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Delete config by ID with ConfigService cache integration
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


  /**
   * Hash master key with salt using SHA-256
   */
  async hashMasterKey(key: string, salt: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(key + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Set master key by hashing it with existing salt
   * Special handling for api.master_key to store only the hash
   */
  async setMasterKey(rawKey: string): Promise<Config> {
    const salt = ConfigService.get('api.master_key_salt');
    if (!salt || salt === '') {
      throw new Error('Master key salt not found. System initialization required.');
    }
    
    // Hash the raw key
    const hash = await this.hashMasterKey(rawKey, salt);
    
    // Store only the hash
    const result = await ConfigService.upsert('api.master_key_hash', hash, 'string', 'Master key hash for full API access');
    
    // Clear the raw key from memory (parameter is already passed by value)
    // Note: This is a best-effort approach in JavaScript
    
    return result;
  }
}

/**
 * Get configuration item descriptions
 */
export function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    'google.client_id': 'Google OAuth2 Client ID',
    'google.client_secret': 'Google OAuth2 Client Secret',
    'google.sheetId': 'Main Google Spreadsheet ID',
    'auth0.domain': 'Auth0 Domain',
    'auth0.client_id': 'Auth0 Application Client ID',
    'auth0.client_secret': 'Auth0 Application Client Secret',
    'auth0.audience': 'Auth0 API Audience (optional)',
    'auth0.scope': 'OAuth2 Scope',
    'app.config_password': 'Configuration screen access password',
    'app.setup_completed': 'Initial setup completion flag',
    'storage.type': 'File storage type (r2 | google_drive)',
    'api.master_key_hash': 'Master key hash for full API access',
    'api.master_key_salt': 'Salt for master key hashing'
  };
  
  return descriptions[key] || 'Configuration item';
}