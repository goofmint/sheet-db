import { eq, lt } from 'drizzle-orm';
import { AbstractBaseRepository } from './base';
import { 
  cacheTable, 
  type Cache, 
  type CacheInsert, 
  type CacheUpdate 
} from '../db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Cache Repository for managing Google Sheets data cache
 */
export class CacheRepository extends AbstractBaseRepository<Cache, CacheInsert, CacheUpdate> {
  
  constructor(database: DrizzleD1Database) {
    super(database);
  }

  /**
   * Find cache entry by ID
   */
  async findById(id: number): Promise<Cache | null> {
    const result = await this.db
      .select()
      .from(cacheTable)
      .where(eq(cacheTable.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Find all cache entries with optional pagination
   */
  async findAll(limit = 100, offset = 0): Promise<Cache[]> {
    return await this.db
      .select()
      .from(cacheTable)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Create new cache entry
   */
  async create(data: CacheInsert): Promise<Cache> {
    const result = await this.db
      .insert(cacheTable)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Update cache entry by ID
   */
  async update(id: number, data: CacheUpdate): Promise<Cache | null> {
    const result = await this.db
      .update(cacheTable)
      .set(data)
      .where(eq(cacheTable.id, id))
      .returning();
    
    return result[0] || null;
  }

  /**
   * Delete cache entry by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(cacheTable)
      .where(eq(cacheTable.id, id))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Find cache entry by cache key
   */
  async findByKey(cacheKey: string): Promise<Cache | null> {
    const result = await this.db
      .select()
      .from(cacheTable)
      .where(eq(cacheTable.cache_key, cacheKey))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Find valid (non-expired) cache entry by key
   */
  async findValidByKey(cacheKey: string): Promise<Cache | null> {
    const now = new Date().toISOString();
    const result = await this.db
      .select()
      .from(cacheTable)
      .where(eq(cacheTable.cache_key, cacheKey))
      .limit(1);
    
    const cache = result[0];
    if (!cache) return null;
    
    // Check if cache is expired
    if (cache.expires_at < now) {
      return null;
    }
    
    return cache;
  }

  /**
   * Upsert cache entry by key
   */
  async upsertByKey(cacheKey: string, data: CacheInsert): Promise<Cache> {
    const result = await this.db
      .insert(cacheTable)
      .values(data)
      .onConflictDoUpdate({
        target: cacheTable.cache_key,
        set: {
          data: data.data,
          expires_at: data.expires_at,
          metadata: data.metadata,
          updated_at: new Date().toISOString()
        }
      })
      .returning();
    
    return result[0];
  }

  /**
   * Delete cache entry by key
   */
  async deleteByKey(cacheKey: string): Promise<boolean> {
    const result = await this.db
      .delete(cacheTable)
      .where(eq(cacheTable.cache_key, cacheKey))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Delete all expired cache entries
   */
  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .delete(cacheTable)
      .where(lt(cacheTable.expires_at, now))
      .returning();
    
    return result.length;
  }

  /**
   * Get cached data with type parsing
   */
  async get<T>(key: string): Promise<T | null> {
    const cache = await this.findValidByKey(key);
    if (!cache) return null;
    
    try {
      return JSON.parse(cache.data) as T;
    } catch (error) {
      // If JSON parsing fails, delete the corrupted cache entry
      await this.deleteByKey(key);
      return null;
    }
  }

  /**
   * Set cached data with expiration
   */
  async set<T>(key: string, data: T, expiresAt: Date, metadata?: object): Promise<void> {
    const cacheData: CacheInsert = {
      cache_key: key,
      data: JSON.stringify(data),
      expires_at: expiresAt.toISOString(),
      metadata: metadata ? JSON.stringify(metadata) : undefined
    };

    await this.upsertByKey(key, cacheData);
  }

  /**
   * Invalidate (delete) cache entry
   */
  async invalidate(key: string): Promise<void> {
    await this.deleteByKey(key);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.db.delete(cacheTable);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ total: number; expired: number }> {
    const now = new Date().toISOString();
    
    const [totalResult, expiredResult] = await Promise.all([
      this.db.select({ count: 'COUNT(*)' }).from(cacheTable),
      this.db.select({ count: 'COUNT(*)' }).from(cacheTable).where(lt(cacheTable.expires_at, now))
    ]);

    return {
      total: Number(totalResult[0]?.count) || 0,
      expired: Number(expiredResult[0]?.count) || 0
    };
  }
}