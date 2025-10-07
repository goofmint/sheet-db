/**
 * Unit tests for database schema definitions
 *
 * These tests verify that all table schemas are correctly defined
 * with proper columns, types, indexes, and constraints.
 */

import { describe, it, expect } from 'vitest';
import {
  config,
  cacheEntries,
  userSessions,
  rateLimits,
} from '../../../src/db/schema';

describe('Database Schema', () => {
  describe('config table', () => {
    it('should have correct table name', () => {
      // Drizzle table name is accessible via special symbol
      expect((config as any)[Symbol.for('drizzle:Name')]).toBe('config');
    });

    it('should have all required columns', () => {
      // Verify config table has all expected columns
      const columns = Object.keys(config);
      expect(columns).toContain('key');
      expect(columns).toContain('value');
      expect(columns).toContain('description');
      expect(columns).toContain('updated_at');
    });

    it('should have primary key on key column', () => {
      // key column should be defined as primary key
      expect(config.key.primary).toBe(true);
    });

    it('should have not null constraint on value', () => {
      // value column should be not null
      expect(config.value.notNull).toBe(true);
    });
  });

  describe('cache_entries table', () => {
    it('should have correct table name', () => {
      expect((cacheEntries as any)[Symbol.for('drizzle:Name')]).toBe(
        'cache_entries'
      );
    });

    it('should have all required columns', () => {
      const columns = Object.keys(cacheEntries);
      expect(columns).toContain('sheet_name');
      expect(columns).toContain('data');
      expect(columns).toContain('ttl');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have primary key on sheet_name', () => {
      expect(cacheEntries.sheet_name.primary).toBe(true);
    });

    it('should have not null constraints', () => {
      expect(cacheEntries.data.notNull).toBe(true);
      expect(cacheEntries.ttl.notNull).toBe(true);
      expect(cacheEntries.created_at.notNull).toBe(true);
      expect(cacheEntries.updated_at.notNull).toBe(true);
    });
  });

  describe('user_sessions table', () => {
    it('should have correct table name', () => {
      expect((userSessions as any)[Symbol.for('drizzle:Name')]).toBe(
        'user_sessions'
      );
    });

    it('should have all required columns', () => {
      const columns = Object.keys(userSessions);
      expect(columns).toContain('token_hash');
      expect(columns).toContain('user_id');
      expect(columns).toContain('expires_at');
      expect(columns).toContain('created_at');
    });

    it('should have primary key on token_hash', () => {
      expect(userSessions.token_hash.primary).toBe(true);
    });

    it('should have not null constraints', () => {
      expect(userSessions.user_id.notNull).toBe(true);
      expect(userSessions.expires_at.notNull).toBe(true);
      expect(userSessions.created_at.notNull).toBe(true);
    });
  });

  describe('rate_limits table', () => {
    it('should have correct table name', () => {
      expect((rateLimits as any)[Symbol.for('drizzle:Name')]).toBe(
        'rate_limits'
      );
    });

    it('should have all required columns', () => {
      const columns = Object.keys(rateLimits);
      expect(columns).toContain('client_id');
      expect(columns).toContain('endpoint');
      expect(columns).toContain('count');
      expect(columns).toContain('window_start');
    });

    it('should have not null constraints', () => {
      expect(rateLimits.client_id.notNull).toBe(true);
      expect(rateLimits.endpoint.notNull).toBe(true);
      expect(rateLimits.count.notNull).toBe(true);
      expect(rateLimits.window_start.notNull).toBe(true);
    });

    it('should have default value for count', () => {
      // count column should have default value of 0
      expect(rateLimits.count.hasDefault).toBe(true);
    });
  });
});
