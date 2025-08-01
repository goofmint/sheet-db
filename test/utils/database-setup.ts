import { sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { configTable } from '../../src/db/schema';

/**
 * Drop all tables in the test database
 */
export async function dropAllTables(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS Config`);
  await db.run(sql`DROP TABLE IF EXISTS Cache`);
  await db.run(sql`DROP TABLE IF EXISTS Session`);
}

/**
 * Create Config table with indexes
 */
export async function createConfigTable(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`
    CREATE TABLE Config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
        description TEXT,
        system_config INTEGER NOT NULL DEFAULT 0 CHECK (system_config IN (0, 1)),
        validation TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.run(sql`CREATE INDEX idx_config_key ON Config(key)`);
  await db.run(sql`CREATE INDEX idx_config_type ON Config(type)`);
  await db.run(sql`CREATE INDEX idx_config_system ON Config(system_config)`);
}

/**
 * Create Cache table with indexes
 */
export async function createCacheTable(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`
    CREATE TABLE Cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'json')),
        ttl INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        UNIQUE(namespace, key)
    )
  `);

  // Create indexes
  await db.run(sql`CREATE INDEX idx_cache_namespace_key ON Cache(namespace, key)`);
  await db.run(sql`CREATE INDEX idx_cache_expires_at ON Cache(expires_at)`);
}

/**
 * Create Session table with indexes
 */
export async function createSessionTable(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`
    CREATE TABLE Session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        user_data TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.run(sql`CREATE INDEX idx_session_session_id ON Session(session_id)`);
  await db.run(sql`CREATE INDEX idx_session_user_id ON Session(user_id)`);
  await db.run(sql`CREATE INDEX idx_session_expires_at ON Session(expires_at)`);
}

/**
 * Setup Config database - drops and recreates Config table
 */
export async function setupConfigDatabase(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS Config`);
  await createConfigTable(db);
}

/**
 * Setup Cache database - drops and recreates Cache table
 */
export async function setupCacheDatabase(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS Cache`);
  await createCacheTable(db);
}

/**
 * Setup Session database - drops and recreates Session table
 */
export async function setupSessionDatabase(db: DrizzleD1Database): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS Session`);
  await createSessionTable(db);
}

/**
 * Initialize test database with all tables
 * Drops existing tables and creates fresh ones
 */
export async function setupTestDatabase(db: DrizzleD1Database): Promise<void> {
  // Setup each database table
  await setupConfigDatabase(db);
  await setupCacheDatabase(db);
  await setupSessionDatabase(db);
}

/**
 * Insert default config data for testing
 */
export async function insertDefaultConfigData(db: DrizzleD1Database): Promise<void> {
  // Split into smaller batches to avoid SQLite variable limit
  const configData = [
    // Application basic settings
    { key: 'app.setup_completed', value: 'false', type: 'boolean', description: 'Flag indicating whether setup is completed' },
    { key: 'app.name', value: 'Sheet DB', type: 'string', description: 'Application name' },
    { key: 'app.version', value: '1.0.0', type: 'string', description: 'Application version' },

    // Cache settings
    { key: 'cache.default_ttl', value: '600', type: 'number', description: 'Default cache TTL in seconds' },
    { key: 'cache.max_entries', value: '1000', type: 'number', description: 'Maximum cache entries' },
    { key: 'cache.cleanup_interval', value: '3600', type: 'number', description: 'Cache cleanup interval in seconds' },

    // Session settings
    { key: 'session.default_ttl', value: '86400', type: 'number', description: 'Default session TTL in seconds' },
    { key: 'session.max_sessions_per_user', value: '10', type: 'number', description: 'Maximum sessions per user' },

    // Google Sheets API settings
    { key: 'google.sheets.batch_size', value: '1000', type: 'number', description: 'Maximum rows for batch processing' },
    { key: 'google.sheets.rate_limit_delay', value: '100', type: 'number', description: 'Delay for API rate limit avoidance in milliseconds' },

    // API permissions for sheet operations
    { key: 'google.sheets.allowed_operations', value: '["read", "write", "create", "delete"]', type: 'json', description: 'Allowed Google Sheets operations' },

    // General permission flags
    { key: 'permissions.allow_sheet_creation', value: 'true', type: 'boolean', description: 'Allow creation of new sheets' },
    { key: 'permissions.allow_sheet_deletion', value: 'false', type: 'boolean', description: 'Allow deletion of sheets' },
    { key: 'permissions.allow_data_export', value: 'true', type: 'boolean', description: 'Allow data export' },
    { key: 'permissions.allow_data_import', value: 'true', type: 'boolean', description: 'Allow data import' },

    // Queue settings
    { key: 'queue.processing_batch_size', value: '10', type: 'number', description: 'Queue batch processing size' },
    { key: 'queue.retry_max_attempts', value: '3', type: 'number', description: 'Maximum retry attempts for failed jobs' },
    { key: 'queue.retry_delay', value: '1000', type: 'number', description: 'Retry delay in milliseconds' },

    // WebSocket settings
    { key: 'websocket.heartbeat_interval', value: '30000', type: 'number', description: 'WebSocket heartbeat interval in milliseconds' },
    { key: 'websocket.max_connections_per_user', value: '5', type: 'number', description: 'Maximum WebSocket connections per user' },

    // Background task settings
    { key: 'background.cache_refresh_interval', value: '600', type: 'number', description: 'Background cache refresh interval in seconds' },
    { key: 'background.cleanup_old_sessions_interval', value: '3600', type: 'number', description: 'Old session cleanup interval in seconds' }
  ] as const;

  // Insert in batches of 5 to avoid SQLite variable limits
  const batchSize = 5;
  for (let i = 0; i < configData.length; i += batchSize) {
    const batch = configData.slice(i, i + batchSize);
    await db.insert(configTable).values(batch);
  }
}