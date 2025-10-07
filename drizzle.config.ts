/**
 * Drizzle Kit configuration for database migrations
 *
 * This configuration file is used by Drizzle Kit to generate and manage
 * database migrations for Cloudflare D1 (SQLite).
 *
 * Migrations are stored in src/db/migrations and are generated based on
 * the schema defined in src/db/schema.ts.
 *
 * Usage:
 * - Generate migration: npx drizzle-kit generate
 * - Apply migration (local): wrangler d1 migrations apply sheet-db --local
 * - Apply migration (production): wrangler d1 migrations apply sheet-db --remote
 */

import type { Config } from 'drizzle-kit';

export default {
  // Schema source file path
  schema: './src/db/schema.ts',

  // Migration output directory
  out: './src/db/migrations',

  // Database driver for Cloudflare D1
  dialect: 'sqlite',

  // D1 specific configuration
  driver: 'd1-http',
} satisfies Config;
