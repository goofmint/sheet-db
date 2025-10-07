/**
 * Database client for Cloudflare D1 with Drizzle ORM
 *
 * This module provides the database client factory function that creates
 * a configured Drizzle ORM instance for interacting with Cloudflare D1.
 *
 * The client is initialized with the D1 database binding from the
 * Cloudflare Workers environment and includes the complete schema
 * for type-safe database operations.
 */

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { Env } from '../types/env';

/**
 * Create database client instance
 *
 * Initializes a Drizzle ORM client with the D1 database binding from
 * Cloudflare Workers environment. The client is fully typed with the
 * schema for compile-time type safety.
 *
 * @param env - Cloudflare Workers environment bindings
 * @returns Configured Drizzle ORM client with schema
 *
 * @example
 * ```typescript
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const db = createDbClient(env);
 *     const configs = await db.select().from(schema.config);
 *     return new Response(JSON.stringify(configs));
 *   }
 * }
 * ```
 */
export function createDbClient(
  env: Env
): DrizzleD1Database<typeof schema> {
  // Initialize Drizzle ORM with D1 database binding
  // The schema is passed to enable type-safe queries and IntelliSense
  return drizzle(env.DB, { schema });
}

/**
 * Database client type for use in application code
 *
 * This type can be used throughout the application to maintain
 * consistent typing for the database client instance.
 *
 * @example
 * ```typescript
 * function getUserSession(db: DbClient, tokenHash: string) {
 *   return db.select()
 *     .from(schema.userSessions)
 *     .where(eq(schema.userSessions.token_hash, tokenHash))
 *     .limit(1);
 * }
 * ```
 */
export type DbClient = ReturnType<typeof createDbClient>;
