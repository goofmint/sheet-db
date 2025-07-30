import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { ConfigRepository } from '../../src/repositories/config';
import { ConfigService } from '../../src/services/config';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { setupTestDatabase, insertDefaultConfigData } from '../utils/database-setup';
import { configTable } from '../../src/db/schema';

describe('ConfigRepository Integration Tests', () => {
  let drizzleDb: DrizzleD1Database;
  let repository: ConfigRepository;

  beforeAll(async () => {
    // Get the test database from cloudflare:test environment
    const db = env.DB;
    
    // Initialize Drizzle and repository
    drizzleDb = drizzle(db);
    repository = new ConfigRepository(drizzleDb);
    
    // Setup clean database schema
    await setupTestDatabase(drizzleDb);
    
    // Insert default config data
    await insertDefaultConfigData(drizzleDb);
    
    // Initialize ConfigService with test database
    await ConfigService.initialize(drizzleDb);
  });

  afterEach(async () => {
    // Re-initialize ConfigService to reload fresh data from database
    await ConfigService.refreshCache();
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
      const allowedOperations = repository.getJson<string[]>('google.sheets.allowed_operations');
      expect(Array.isArray(allowedOperations)).toBe(true);
      expect(allowedOperations).toEqual(['read', 'write', 'create', 'delete']);

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

  describe('getAll method', () => {
    it('should return all config entries as key-value pairs', async () => {
      await ConfigService.upsert('test.key1', 'value1');
      await ConfigService.upsert('test.key2', 'value2');
      await ConfigService.upsert('test.key3', 'value3');

      const allConfigs = ConfigService.getAll();
      
      expect(Object.keys(allConfigs)).toContain('test.key1');
      expect(Object.keys(allConfigs)).toContain('test.key2');
      expect(Object.keys(allConfigs)).toContain('test.key3');
      expect(allConfigs['test.key1']).toBe('value1');
      expect(allConfigs['test.key2']).toBe('value2');
      expect(allConfigs['test.key3']).toBe('value3');
    });

    it('should return empty object when no configs exist', async () => {
      // Clear all existing configs
      const configs = await drizzleDb.select().from(configTable);
      for (const config of configs) {
        await drizzleDb.delete(configTable).where(eq(configTable.id, config.id));
      }
      
      // Refresh cache to reflect empty state
      await ConfigService.refreshCache();
      
      const allConfigs = ConfigService.getAll();
      expect(allConfigs).toEqual({});
    });
  });

  describe('getType method', () => {
    it('should return correct type for existing config', async () => {
      await ConfigService.upsert('test.string', 'value', 'string');
      await ConfigService.upsert('test.boolean', 'true', 'boolean');
      await ConfigService.upsert('test.number', '42', 'number');
      await ConfigService.upsert('test.json', '{}', 'json');

      expect(ConfigService.getType('test.string')).toBe('string');
      expect(ConfigService.getType('test.boolean')).toBe('boolean');
      expect(ConfigService.getType('test.number')).toBe('number');
      expect(ConfigService.getType('test.json')).toBe('json');
    });

    it('should return string as default type for non-existent config', () => {
      expect(ConfigService.getType('non.existent')).toBe('string');
    });
  });

});