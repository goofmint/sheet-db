import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Base repository interface for common database operations
 */
export interface BaseRepository<T, InsertT, UpdateT> {
  findById(id: number): Promise<T | null>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  create(data: InsertT): Promise<T>;
  update(id: number, data: UpdateT): Promise<T | null>;
  delete(id: number): Promise<boolean>;
}

/**
 * Abstract base repository class with common functionality
 */
export abstract class AbstractBaseRepository<T, InsertT, UpdateT> 
  implements BaseRepository<T, InsertT, UpdateT> {
  
  protected db: DrizzleD1Database;

  constructor(database: DrizzleD1Database) {
    this.db = database;
  }

  abstract findById(id: number): Promise<T | null>;
  abstract findAll(limit?: number, offset?: number): Promise<T[]>;
  abstract create(data: InsertT): Promise<T>;
  abstract update(id: number, data: UpdateT): Promise<T | null>;
  abstract delete(id: number): Promise<boolean>;
}