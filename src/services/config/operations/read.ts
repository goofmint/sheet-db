import type { Config } from '../../../db/schema';
import { ConfigCache } from '../cache';
import { ConfigInitializer } from '../initializer';

/**
 * Read operations for configuration management
 * Provides synchronous access to cached configuration values
 */
export class ConfigReader {
  /**
   * Get config entry by key (synchronous)
   */
  static findByKey(key: string): Config | null {
    ConfigInitializer.ensureInitialized();
    return ConfigCache.get(key);
  }

  /**
   * Check if config key exists (synchronous)
   */
  static has(key: string): boolean {
    ConfigInitializer.ensureInitialized();
    return ConfigCache.has(key);
  }

  /**
   * Get config value with optional default (synchronous)
   */
  static get(key: string, defaultValue?: string): string | null {
    const config = this.findByKey(key);
    return config?.value ?? defaultValue ?? null;
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
    ConfigInitializer.ensureInitialized();
    return ConfigCache.keys();
  }

  /**
   * Get all config entries as key-value pairs (synchronous)
   */
  static getAll(): Record<string, string> {
    ConfigInitializer.ensureInitialized();
    return ConfigCache.getAllAsRecord();
  }

  /**
   * Get config type (synchronous)
   */
  static getType(key: string): string {
    const config = this.findByKey(key);
    return config?.type || 'string';
  }

  /**
   * Get config cache size (synchronous)
   */
  static size(): number {
    ConfigInitializer.ensureInitialized();
    return ConfigCache.size();
  }
}