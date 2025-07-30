import type { Config, ConfigType } from '../../db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export type ConfigServiceDatabase = DrizzleD1Database;

export interface ConfigEntry {
  value: string;
  type?: ConfigType;
}

export interface ConfigCacheEntry extends Config {}

export type ConfigUpdatePayload = Record<string, ConfigEntry>;