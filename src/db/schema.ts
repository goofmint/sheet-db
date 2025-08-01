import { int, sqliteTable, text, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Config table for application settings
export const configTable = sqliteTable('Config', {
  id: int().primaryKey({ autoIncrement: true }),
  key: text().notNull().unique(),
  value: text().notNull(),
  type: text().notNull().default('string'),
  description: text(),
  system_config: int().notNull().default(0), // 0 = false, 1 = true (SQLite doesn't have native boolean)
  validation: text(), // JSON string for validation rules
  created_at: text().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  typeCheck: check('type_check', sql`${table.type} IN ('string', 'number', 'boolean', 'json')`),
  systemConfigCheck: check('system_config_check', sql`${table.system_config} IN (0, 1)`),
}));

// Cache table for Google Sheets data caching
export const cacheTable = sqliteTable('Cache', {
  id: int().primaryKey({ autoIncrement: true }),
  cache_key: text().notNull().unique(),
  data: text().notNull(), // JSON format data
  expires_at: text().notNull(), // ISO datetime string
  created_at: text().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text().default(sql`CURRENT_TIMESTAMP`),
  metadata: text(), // JSON format metadata
});

// Session table for user session management
export const sessionTable = sqliteTable('Session', {
  id: int().primaryKey({ autoIncrement: true }),
  session_id: text().notNull().unique(),
  user_id: text().notNull(),
  user_data: text().notNull(), // JSON format user info
  access_token: text(),
  refresh_token: text(),
  expires_at: text().notNull(), // ISO datetime string
  created_at: text().default(sql`CURRENT_TIMESTAMP`),
  updated_at: text().default(sql`CURRENT_TIMESTAMP`),
});

// Type definitions for database operations
export type ConfigType = 'string' | 'number' | 'boolean' | 'json';

export interface Config {
  id: number;
  key: string;
  value: string;
  type: ConfigType;
  description: string | null;
  system_config: number; // 0 = false, 1 = true
  validation: string | null; // JSON string
  created_at: string | null;
  updated_at: string | null;
}

export interface ConfigInsert {
  key: string;
  value: string;
  type?: ConfigType;
  description?: string;
  system_config?: number;
  validation?: string;
}

export interface ConfigUpdate {
  value?: string;
  type?: ConfigType;
  description?: string;
  system_config?: number;
  validation?: string;
}

export interface Cache {
  id: number;
  cache_key: string;
  data: string;
  expires_at: string;
  created_at: string | null;
  updated_at: string | null;
  metadata: string | null;
}

export interface CacheInsert {
  cache_key: string;
  data: string;
  expires_at: string;
  metadata?: string;
}

export interface CacheUpdate {
  data?: string;
  expires_at?: string;
  metadata?: string;
}

export interface Session {
  id: number;
  session_id: string;
  user_id: string;
  user_data: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface SessionInsert {
  session_id: string;
  user_id: string;
  user_data: string;
  access_token?: string;
  refresh_token?: string;
  expires_at: string;
}

export interface SessionUpdate {
  user_data?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
}
