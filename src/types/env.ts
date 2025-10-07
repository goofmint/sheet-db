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

  /**
   * Encryption key for sensitive configuration values
   *
   * Used to encrypt/decrypt sensitive data stored in config table
   * (e.g., Google Client Secret, R2 credentials, master key)
   */
  ENCRYPTION_KEY: string;

  /**
   * OAuth state signature secret
   *
   * Used for HMAC-SHA256 signing of OAuth state tokens for CSRF protection
   * Should be a cryptographically random string (32+ characters)
   */
  OAUTH_STATE_SECRET: string;
}
