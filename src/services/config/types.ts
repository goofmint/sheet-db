import type { Config, ConfigType } from '../../db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export type ConfigServiceDatabase = DrizzleD1Database;

// Extract transaction type from the database's transaction method
export type DatabaseTransaction = Parameters<ConfigServiceDatabase['transaction']>[0] extends (tx: infer T) => any ? T : never;

export interface ConfigEntry {
  value: string;
  type?: ConfigType;
}

export interface ConfigCacheEntry extends Config {}

export type ConfigUpdatePayload = Record<string, ConfigEntry>;