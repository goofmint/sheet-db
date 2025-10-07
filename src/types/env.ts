// Environment variables and bindings for Cloudflare Workers

import type { D1Database } from '@cloudflare/workers-types';

/**
 * Cloudflare Workers environment bindings
 *
 * This interface defines all environment variables and resource bindings
 * available in the Cloudflare Workers runtime environment.
 */
export interface Env {
  /**
   * Environment name (development, staging, production)
   */
  ENVIRONMENT: string;

  /**
   * D1 Database binding for SQLite database access
   *
   * Configured in wrangler.toml as [[d1_databases]] binding.
   * Provides access to the sheet-db D1 database instance.
   */
  DB: D1Database;
}
