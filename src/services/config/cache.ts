import type { Config } from '../../db/schema';
import type { ConfigCacheEntry } from './types';

/**
 * In-memory cache for configuration data
 */
export class ConfigCache {
  private static cache = new Map<string, ConfigCacheEntry>();

  /**
   * Get config entry from cache
   */
  static get(key: string): ConfigCacheEntry | null {
    return this.cache.get(key) || null;
  }

  /**
   * Set config entry in cache
   */
  static set(key: string, config: ConfigCacheEntry): void {
    this.cache.set(key, config);
  }

  /**
   * Check if key exists in cache
   */
  static has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * Get all cache keys
   */
  static keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  static size(): number {
    return this.cache.size;
  }

  /**
   * Load multiple configs into cache
   */
  static loadAll(configs: Config[]): void {
    this.cache.clear();
    for (const config of configs) {
      this.cache.set(config.key, config);
    }
  }

  /**
   * Get all config entries as key-value pairs
   */
  static getAllAsRecord(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, config] of this.cache) {
      result[key] = config.value;
    }
    return result;
  }

  /**
   * Get all cache entries (for debugging)
   */
  static getAll(): Map<string, ConfigCacheEntry> {
    return new Map(this.cache);
  }
}