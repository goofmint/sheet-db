import { describe, it, expect } from 'vitest';
import { ConfigService } from '../src/services/config';
import { ConfigRepository } from '../src/repositories/config';
import { CacheRepository } from '../src/repositories/cache';
import { SessionRepository } from '../src/repositories/session';
import { configTable, cacheTable, sessionTable } from '../src/db/schema';

describe('Database Component Tests', () => {
  
  describe('ConfigService', () => {
    it('should not be initialized by default', () => {
      ConfigService.reset();
      expect(ConfigService.isInitialized()).toBe(false);
    });

    it('should throw error when accessing data before initialization', () => {
      ConfigService.reset();
      
      expect(() => ConfigService.getString('nonexistent')).toThrow('ConfigService not initialized');
      expect(() => ConfigService.getNumber('nonexistent')).toThrow('ConfigService not initialized');
      expect(() => ConfigService.getBoolean('nonexistent')).toThrow('ConfigService not initialized');
    });

    it('should handle reset correctly', () => {
      ConfigService.reset();
      expect(ConfigService.isInitialized()).toBe(false);
    });
  });

  describe('Database Schema Validation', () => {
    it('should have valid table definitions', () => {
      // Test that table schemas are properly defined
      expect(configTable).toBeDefined();
      expect(cacheTable).toBeDefined();
      expect(sessionTable).toBeDefined();
    });

    it('should export required types', () => {
      // Test that types are available from schema
      expect(typeof ConfigRepository).toBe('function');
      expect(typeof CacheRepository).toBe('function');
      expect(typeof SessionRepository).toBe('function');
    });
  });

  describe('Type Validation', () => {
    it('should have static methods available', () => {
      // Test that static methods exist and are callable
      expect(typeof ConfigService.isInitialized).toBe('function');
      expect(typeof ConfigService.reset).toBe('function');
      
      // Test constructor functions exist
      expect(typeof ConfigRepository).toBe('function');
      expect(typeof CacheRepository).toBe('function');
      expect(typeof SessionRepository).toBe('function');
    });
  });
});