/**
 * Drizzle ORM schema definitions for all database tables
 *
 * This module defines the complete database schema for the Sheet DB application,
 * including:
 * - config: System-wide configuration key-value store
 * - cache_entries: Google Sheets API response cache
 * - user_sessions: JWT token session management
 * - rate_limits: API rate limiting tracking
 *
 * All tables use SQLite (Cloudflare D1) as the underlying database.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Config table: System-wide configuration key-value store
 *
 * Stores settings like Google Sheets ID, API configurations, system parameters, etc.
 * Uses a simple key-value structure for flexibility.
 *
 * Example entries:
 * - SHEET_ID: The Google Sheets document ID
 * - MAX_FILE_SIZE: Maximum file upload size in bytes
 * - CACHE_DEFAULT_TTL: Default cache TTL in seconds
 */
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updated_at: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * Cache entries table: Stores Google Sheets API response cache
 *
 * Caches sheet data to improve performance and reduce API calls.
 * Each entry is identified by sheet name and includes TTL for expiration.
 *
 * The data column stores the complete sheet data as a JSON string.
 * updated_at is indexed for efficient cleanup of old cache entries.
 */
export const cacheEntries = sqliteTable(
  'cache_entries',
  {
    sheet_name: text('sheet_name').primaryKey(),
    data: text('data').notNull(), // JSON string of sheet data
    ttl: integer('ttl').notNull(), // Time-to-live in seconds
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
    updated_at: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for efficient cleanup of expired cache entries
    updatedAtIdx: index('cache_entries_updated_at_idx').on(table.updated_at),
  })
);

/**
 * User sessions table: Manages JWT token sessions
 *
 * Enables session management and token invalidation on logout.
 * Stores hashed tokens (never store raw tokens!) along with user ID and expiration.
 *
 * Sessions are indexed by user_id for quick lookup of all user sessions,
 * and by expires_at for efficient cleanup of expired sessions.
 */
export const userSessions = sqliteTable(
  'user_sessions',
  {
    token_hash: text('token_hash').primaryKey(), // SHA-256 hash of JWT token
    user_id: text('user_id').notNull(), // References _Users sheet object_id
    expires_at: integer('expires_at', { mode: 'timestamp' }).notNull(),
    created_at: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Index for finding all sessions for a specific user
    userIdIdx: index('user_sessions_user_id_idx').on(table.user_id),
    // Index for efficiently cleaning up expired sessions
    expiresAtIdx: index('user_sessions_expires_at_idx').on(table.expires_at),
  })
);

/**
 * Rate limits table: Tracks API request rates per client and endpoint
 *
 * Implements rate limiting to prevent abuse and ensure fair usage.
 * Uses a sliding window approach with composite primary key (client_id, endpoint).
 *
 * The count is incremented for each request and reset when the window expires.
 * window_start is indexed for efficient cleanup of old rate limit records.
 */
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    client_id: text('client_id').notNull(), // IP address or API key
    endpoint: text('endpoint').notNull(), // API endpoint path
    count: integer('count').notNull().default(0), // Request count in current window
    window_start: integer('window_start', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    // Composite primary key for UPSERT operations (client + endpoint combination)
    pk: primaryKey({ columns: [table.client_id, table.endpoint] }),
    // Index for cleaning up old rate limit windows
    windowStartIdx: index('rate_limits_window_start_idx').on(
      table.window_start
    ),
  })
);

// Export type helpers for TypeScript type inference
// These enable type-safe database operations throughout the application

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;

export type CacheEntry = typeof cacheEntries.$inferSelect;
export type NewCacheEntry = typeof cacheEntries.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
