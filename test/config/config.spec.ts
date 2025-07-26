import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigRepository } from '../../src/repositories/config';
import { ConfigService } from '../../src/services/config';
import { sql } from 'drizzle-orm';
import { configTable } from '../../src/db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

// Test setup function to prepare clean database schema using Drizzle
async function setupTestDatabase(drizzleDb: DrizzleD1Database) {
  // Drop existing tables if they exist using Drizzle sql
  await drizzleDb.run(sql`DROP TABLE IF EXISTS Config`);

  // Create Config table using direct SQL based on our schema definition
  await drizzleDb.run(sql`
    CREATE TABLE Config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for Config table
  await drizzleDb.run(sql`CREATE INDEX idx_config_key ON Config(key)`);

  // Insert initial config data using Drizzle
  await drizzleDb.insert(configTable).values([
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
    { key: 'api.sheet.allow_create', value: 'false', type: 'boolean', description: 'Allow sheet creation via API' },
    { key: 'api.sheet.allow_modify', value: 'false', type: 'boolean', description: 'Allow sheet modification (add/remove columns) via API' },
    { key: 'api.sheet.allow_delete', value: 'false', type: 'boolean', description: 'Allow sheet deletion via API' },

    // Security settings
    { key: 'security.api_rate_limit', value: '100', type: 'number', description: 'API request limit per minute' },
    { key: 'security.cors_origins', value: '["*"]', type: 'json', description: 'Allowed CORS origins (array)' },

    // UI settings
    { key: 'ui.theme', value: 'dark', type: 'string', description: 'Default theme' },
    { key: 'ui.language', value: 'en', type: 'string', description: 'Default language' },
    { key: 'ui.timezone', value: 'UTC', type: 'string', description: 'Default timezone' }
  ]);
}

describe('ConfigRepository Integration Tests', () => {
  let drizzleDb: DrizzleD1Database;
  let repository: ConfigRepository;

  beforeAll(async () => {
    // Get the test database from cloudflare:test environment
    // @ts-ignore - cloudflare:test is available in vitest workers environment
    const env = await import('cloudflare:test');
    const db = env.env.DB as D1Database;
    
    // Initialize Drizzle and repository
    drizzleDb = drizzle(db) as DrizzleD1Database;
    repository = new ConfigRepository(drizzleDb);
    
    // Setup clean database schema with initial data using Drizzle
    await setupTestDatabase(drizzleDb);
    
    // Initialize ConfigService with test database
    await ConfigService.initialize(drizzleDb);
  });

  afterEach(async () => {
    // Reset ConfigService cache for clean tests
    ConfigService.clearCache();
    
    // Re-initialize ConfigService to reload fresh data
    await ConfigService.initialize(drizzleDb);
  });

  describe('Direct Database Operations', () => {
    it('should create config without affecting cache', async () => {
      const newConfig = await repository.create({
        key: 'test.direct',
        value: 'direct-value',
        type: 'string',
        description: 'Test direct creation'
      });

      expect(newConfig.key).toBe('test.direct');
      expect(newConfig.value).toBe('direct-value');
      expect(newConfig.type).toBe('string');
      expect(newConfig.id).toBeTypeOf('number');

      // Verify it's in database but not in cache
      const fromDb = await repository.findById(newConfig.id);
      expect(fromDb).not.toBeNull();
      expect(fromDb!.key).toBe('test.direct');

      // Cache should not have this key until reinitialized
      expect(ConfigService.has('test.direct')).toBe(false);
    });

    it('should find config by ID', async () => {
      // Find an existing config by querying first
      const allConfigs = await repository.findAll(1);
      expect(allConfigs.length).toBeGreaterThan(0);
      
      const firstConfig = allConfigs[0];
      const foundConfig = await repository.findById(firstConfig.id);
      
      expect(foundConfig).not.toBeNull();
      expect(foundConfig!.id).toBe(firstConfig.id);
      expect(foundConfig!.key).toBe(firstConfig.key);
    });

    it('should return null for non-existent ID', async () => {
      const nonExistentConfig = await repository.findById(99999);
      expect(nonExistentConfig).toBeNull();
    });

    it('should find all configs with pagination', async () => {
      const allConfigs = await repository.findAll();
      expect(allConfigs.length).toBeGreaterThan(0);
      
      // Test pagination
      const firstPage = await repository.findAll(5, 0);
      const secondPage = await repository.findAll(5, 5);
      
      expect(firstPage.length).toBeLessThanOrEqual(5);
      expect(secondPage.length).toBeGreaterThanOrEqual(0);
      
      // Ensure pages don't overlap
      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].id).not.toBe(secondPage[0].id);
      }
    });
  });

  describe('Cache-Integrated Operations', () => {
    it('should create config with cache integration', async () => {
      const newConfig = await repository.createWithCache({
        key: 'test.cached',
        value: 'cached-value',
        type: 'string',
        description: 'Test cached creation'
      });

      expect(newConfig.key).toBe('test.cached');
      expect(newConfig.value).toBe('cached-value');

      // Should be available in cache immediately
      expect(ConfigService.has('test.cached')).toBe(true);
      expect(ConfigService.getString('test.cached')).toBe('cached-value');
    });

    it('should update config with cache consistency', async () => {
      // Create a config first
      const config = await repository.createWithCache({
        key: 'test.update',
        value: 'original-value',
        type: 'string'
      });

      // Update it
      const updatedConfig = await repository.update(config.id, {
        value: 'updated-value',
        description: 'Updated description'
      });

      expect(updatedConfig).not.toBeNull();
      expect(updatedConfig!.value).toBe('updated-value');
      expect(updatedConfig!.description).toBe('Updated description');

      // Cache should be updated
      expect(ConfigService.getString('test.update')).toBe('updated-value');
    });

    it('should delete config with cache consistency', async () => {
      // Create a config first
      const config = await repository.createWithCache({
        key: 'test.delete',
        value: 'to-be-deleted',
        type: 'string'
      });

      expect(ConfigService.has('test.delete')).toBe(true);

      // Delete it
      const deleted = await repository.delete(config.id);
      expect(deleted).toBe(true);

      // Should be removed from cache
      expect(ConfigService.has('test.delete')).toBe(false);

      // Should be removed from database
      const fromDb = await repository.findById(config.id);
      expect(fromDb).toBeNull();
    });

    it('should handle non-existent updates gracefully', async () => {
      const result = await repository.update(99999, { value: 'new-value' });
      expect(result).toBeNull();
    });

    it('should handle non-existent deletes gracefully', async () => {
      const result = await repository.delete(99999);
      expect(result).toBe(false);
    });
  });

  describe('Key-Based Operations', () => {
    it('should find config by key', () => {
      // Use an existing config key from initial data
      const config = repository.findByKey('app.name');
      expect(config).not.toBeNull();
      expect(config!.key).toBe('app.name');
      expect(config!.value).toBe('Sheet DB');
    });

    it('should upsert config by key', async () => {
      // Insert new
      const newConfig = await repository.upsertByKey('test.upsert', {
        key: 'test.upsert',
        value: 'new-value',
        type: 'string'
      });

      expect(newConfig.key).toBe('test.upsert');
      expect(newConfig.value).toBe('new-value');

      // Update existing
      const updatedConfig = await repository.upsertByKey('test.upsert', {
        key: 'test.upsert',
        value: 'updated-value',
        type: 'string'
      });

      expect(updatedConfig.key).toBe('test.upsert');
      expect(updatedConfig.value).toBe('updated-value');
      expect(updatedConfig.id).toBe(newConfig.id); // Same ID, updated value
    });

    it('should delete config by key', async () => {
      // Create first
      await repository.upsertByKey('test.delete-key', {
        key: 'test.delete-key',
        value: 'to-delete',
        type: 'string'
      });

      expect(repository.has('test.delete-key')).toBe(true);

      // Delete
      const deleted = await repository.deleteByKey('test.delete-key');
      expect(deleted).toBe(true);
      expect(repository.has('test.delete-key')).toBe(false);
    });

    it('should check key existence', () => {
      expect(repository.has('app.name')).toBe(true);
      expect(repository.has('non.existent.key')).toBe(false);
    });
  });

  describe('Type-Safe Value Getters', () => {
    it('should get string values', () => {
      expect(repository.getString('app.name')).toBe('Sheet DB');
      expect(repository.getString('non.existent', 'default')).toBe('default');
    });

    it('should get number values', () => {
      expect(repository.getNumber('cache.default_ttl')).toBe(600);
      expect(repository.getNumber('non.existent', 42)).toBe(42);
    });

    it('should get boolean values', () => {
      expect(repository.getBoolean('app.setup_completed')).toBe(false);
      expect(repository.getBoolean('non.existent', true)).toBe(true);
    });

    it('should get JSON values', () => {
      const corsOrigins = repository.getJson<string[]>('security.cors_origins');
      expect(Array.isArray(corsOrigins)).toBe(true);
      expect(corsOrigins).toEqual(['*']);

      const defaultValue = repository.getJson('non.existent', { default: true });
      expect(defaultValue).toEqual({ default: true });
    });
  });

  describe('Cache Management', () => {
    it('should return all config keys', () => {
      const keys = repository.keys();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('app.name');
      expect(keys).toContain('cache.default_ttl');
    });

    it('should return cache size', () => {
      const size = repository.size();
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });
  });

});