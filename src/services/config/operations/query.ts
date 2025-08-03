import type { Config, ConfigType } from '../../../db/schema';
import { ConfigDatabase } from '../database';
import { ConfigDescriptions } from '../descriptions';
import { ConfigInitializer } from '../initializer';

/**
 * Query operations for configuration management
 * Handles complex queries and information retrieval
 */
export class ConfigQuery {
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
    ConfigInitializer.ensureInitialized();
    return await ConfigDatabase.getConfigsList(params);
  }

  /**
   * Get description for a config key
   */
  static getDescription(key: string): string {
    return ConfigDescriptions.getDescription(key);
  }

  /**
   * Check if a config key is sensitive
   */
  static isSensitive(key: string): boolean {
    return ConfigDescriptions.isSensitive(key);
  }
}