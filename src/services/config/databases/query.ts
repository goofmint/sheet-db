import { eq, like, or, and, desc, asc, count } from 'drizzle-orm';
import { configTable, type Config, type ConfigType } from '../../../db/schema';
import type { ConfigServiceDatabase } from '../types';

/**
 * Database query operations for configuration management
 * Handles complex queries, filtering, searching, and pagination
 */
export class ConfigDatabaseQuery {
  
  /**
   * Get configuration list with pagination, search, and filtering
   */
  static async getConfigsList(
    db: ConfigServiceDatabase,
    params: {
      page: number;
      limit: number;
      search: string;
      type?: ConfigType;
      system?: boolean;
      sort: 'key' | 'type' | 'created_at' | 'updated_at';
      order: 'asc' | 'desc';
    }
  ): Promise<{
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
    const { page, limit, search, type, system, sort, order } = params;
    const offset = (page - 1) * limit;

    // Build search conditions
    const conditions = this.buildSearchConditions(search, type, system);

    // Determine sort column
    const sortColumn = this.getSortColumn(sort);

    // Build query
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

    // Get total count
    const totalCount = await this.getTotalCount(db, whereCondition);

    // Get data
    const rawConfigs = await query;

    // Cast types appropriately and return as Config[]
    const configs: Config[] = rawConfigs.map(config => ({
      ...config,
      type: config.type as ConfigType
    }));

    // Calculate pagination info
    const pagination = this.buildPaginationInfo(totalCount, page, limit);

    return {
      configs,
      pagination
    };
  }

  /**
   * Build search conditions based on parameters
   */
  private static buildSearchConditions(
    search: string,
    type?: ConfigType,
    system?: boolean
  ) {
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

    return conditions;
  }

  /**
   * Get sort column based on sort parameter
   */
  private static getSortColumn(sort: string) {
    const sortColumnMap = {
      'key': configTable.key,
      'type': configTable.type,
      'created_at': configTable.created_at,
      'updated_at': configTable.updated_at
    };

    return sortColumnMap[sort as keyof typeof sortColumnMap] || configTable.key;
  }

  /**
   * Get total count with optional where condition
   */
  private static async getTotalCount(
    db: ConfigServiceDatabase,
    whereCondition?: any
  ): Promise<number> {
    const baseCountQuery = db.select({ count: count() }).from(configTable);
    const countQuery = whereCondition ? baseCountQuery.where(whereCondition) : baseCountQuery;
    const [{ count: total }] = await countQuery;
    return total;
  }

  /**
   * Build pagination information
   */
  private static buildPaginationInfo(
    total: number,
    page: number,
    limit: number
  ) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev
    };
  }
}