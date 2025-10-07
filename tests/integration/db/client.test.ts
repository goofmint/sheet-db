/**
 * Integration tests for database client
 *
 * These tests verify that the database client can successfully connect
 * to D1 and perform basic CRUD operations on all tables.
 *
 * Note: These tests use a real D1 database (--local mode) to ensure
 * no mocking is used, following strict project requirements.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { getTestEnv, cleanupTestEnv } from '../../helpers/test-app';
import * as schema from '../../../src/db/schema';
import { createDbClient } from '../../../src/db/client';
import type { Env } from '../../../src/types/env';

describe('Database Client Integration', () => {
  let env: Env;

  afterAll(async () => {
    await cleanupTestEnv();
  });

  beforeEach(async () => {
    // Get test environment with real D1 database (no mocking)
    // Uses shared platform proxy from test helper to avoid database locks
    env = await getTestEnv();

    // Clear all tables before each test to ensure clean state
    const db = createDbClient(env);

    // Delete all records from all tables
    await db.delete(schema.config);
    await db.delete(schema.cacheEntries);
    await db.delete(schema.userSessions);
    await db.delete(schema.rateLimits);
  });

  describe('Client Creation', () => {
    it('should create database client successfully', async () => {
      const db = createDbClient(env);

      // Client should be defined and have drizzle methods
      expect(db).toBeDefined();
      expect(db.select).toBeDefined();
      expect(db.insert).toBeDefined();
      expect(db.update).toBeDefined();
      expect(db.delete).toBeDefined();

    });
  });

  describe('Config Table Operations', () => {
    it('should insert and select config entries', async () => {
      const db = createDbClient(env);

      // Insert a config entry
      await db.insert(schema.config).values({
        key: 'TEST_KEY',
        value: 'test_value',
        description: 'Test configuration',
      });

      // Select the inserted entry
      const result = await db
        .select()
        .from(schema.config)
        .where(eq(schema.config.key, 'TEST_KEY'));

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('TEST_KEY');
      expect(result[0].value).toBe('test_value');
      expect(result[0].description).toBe('Test configuration');
      expect(result[0].updated_at).toBeInstanceOf(Date);

    });

    it('should update config entries', async () => {
      const db = createDbClient(env);

      // Insert initial entry
      await db.insert(schema.config).values({
        key: 'UPDATE_TEST',
        value: 'old_value',
      });

      // Update the entry
      await db
        .update(schema.config)
        .set({ value: 'new_value' })
        .where(eq(schema.config.key, 'UPDATE_TEST'));

      // Verify update
      const result = await db
        .select()
        .from(schema.config)
        .where(eq(schema.config.key, 'UPDATE_TEST'));

      expect(result[0].value).toBe('new_value');

    });

    it('should delete config entries', async () => {
      const db = createDbClient(env);

      // Insert and then delete
      await db.insert(schema.config).values({
        key: 'DELETE_TEST',
        value: 'to_be_deleted',
      });

      await db
        .delete(schema.config)
        .where(eq(schema.config.key, 'DELETE_TEST'));

      // Verify deletion
      const result = await db
        .select()
        .from(schema.config)
        .where(eq(schema.config.key, 'DELETE_TEST'));

      expect(result).toHaveLength(0);

    });
  });

  describe('Cache Entries Table Operations', () => {
    it('should insert and select cache entries', async () => {
      const db = createDbClient(env);

      const testData = JSON.stringify({ test: 'data' });

      await db.insert(schema.cacheEntries).values({
        sheet_name: 'TestSheet',
        data: testData,
        ttl: 3600,
      });

      const result = await db
        .select()
        .from(schema.cacheEntries)
        .where(eq(schema.cacheEntries.sheet_name, 'TestSheet'));

      expect(result).toHaveLength(1);
      expect(result[0].sheet_name).toBe('TestSheet');
      expect(result[0].data).toBe(testData);
      expect(result[0].ttl).toBe(3600);
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);

    });
  });

  describe('User Sessions Table Operations', () => {
    it('should insert and select user sessions', async () => {
      const db = createDbClient(env);

      // SQLite stores timestamps in seconds, so we need to round to seconds
      const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 86400000); // 24 hours from now

      await db.insert(schema.userSessions).values({
        token_hash: 'test_hash_123',
        user_id: 'user_001',
        expires_at: expiresAt,
      });

      const result = await db
        .select()
        .from(schema.userSessions)
        .where(eq(schema.userSessions.token_hash, 'test_hash_123'));

      expect(result).toHaveLength(1);
      expect(result[0].token_hash).toBe('test_hash_123');
      expect(result[0].user_id).toBe('user_001');
      // SQLite stores timestamps in seconds, compare only second precision
      expect(Math.floor(result[0].expires_at.getTime() / 1000)).toBe(
        Math.floor(expiresAt.getTime() / 1000)
      );
      expect(result[0].created_at).toBeInstanceOf(Date);

    });

    it('should query sessions by user_id using index', async () => {
      const db = createDbClient(env);

      // SQLite stores timestamps in seconds, so we need to round to seconds
      const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 86400000);

      // Insert multiple sessions for same user
      await db.insert(schema.userSessions).values([
        {
          token_hash: 'hash_1',
          user_id: 'user_multi',
          expires_at: expiresAt,
        },
        {
          token_hash: 'hash_2',
          user_id: 'user_multi',
          expires_at: expiresAt,
        },
      ]);

      // Query by user_id (should use index)
      const result = await db
        .select()
        .from(schema.userSessions)
        .where(eq(schema.userSessions.user_id, 'user_multi'));

      expect(result).toHaveLength(2);

    });
  });

  describe('Rate Limits Table Operations', () => {
    it('should insert and select rate limits', async () => {
      const db = createDbClient(env);

      // SQLite stores timestamps in seconds, so we need to round to seconds
      const windowStart = new Date(Math.floor(Date.now() / 1000) * 1000);

      await db.insert(schema.rateLimits).values({
        client_id: '192.168.1.1',
        endpoint: '/api/test',
        count: 5,
        window_start: windowStart,
      });

      const result = await db
        .select()
        .from(schema.rateLimits)
        .where(
          and(
            eq(schema.rateLimits.client_id, '192.168.1.1'),
            eq(schema.rateLimits.endpoint, '/api/test')
          )
        );

      expect(result).toHaveLength(1);
      expect(result[0].client_id).toBe('192.168.1.1');
      expect(result[0].endpoint).toBe('/api/test');
      expect(result[0].count).toBe(5);
      // SQLite stores timestamps in seconds, compare only second precision
      expect(Math.floor(result[0].window_start.getTime() / 1000)).toBe(
        Math.floor(windowStart.getTime() / 1000)
      );

    });

    it('should enforce composite primary key constraint', async () => {
      const db = createDbClient(env);

      // SQLite stores timestamps in seconds, so we need to round to seconds
      const windowStart = new Date(Math.floor(Date.now() / 1000) * 1000);

      // Insert first record
      await db.insert(schema.rateLimits).values({
        client_id: '192.168.1.2',
        endpoint: '/api/endpoint',
        count: 1,
        window_start: windowStart,
      });

      // Attempting to insert duplicate should fail or be handled as UPSERT
      // D1 should enforce the primary key constraint
      await expect(
        db.insert(schema.rateLimits).values({
          client_id: '192.168.1.2',
          endpoint: '/api/endpoint',
          count: 2,
          window_start: windowStart,
        })
      ).rejects.toThrow();

    });

    it('should use default value for count', async () => {
      const db = createDbClient(env);

      // SQLite stores timestamps in seconds, so we need to round to seconds
      const windowStart = new Date(Math.floor(Date.now() / 1000) * 1000);

      // Insert without specifying count
      await db.insert(schema.rateLimits).values({
        client_id: '192.168.1.3',
        endpoint: '/api/default',
        window_start: windowStart,
      });

      const result = await db
        .select()
        .from(schema.rateLimits)
        .where(
          and(
            eq(schema.rateLimits.client_id, '192.168.1.3'),
            eq(schema.rateLimits.endpoint, '/api/default')
          )
        );

      // Default count should be 0
      expect(result[0].count).toBe(0);

    });
  });
});
