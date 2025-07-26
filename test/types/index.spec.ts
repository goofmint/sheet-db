import { describe, it, expect } from 'vitest';

// Import available types to verify they can be imported correctly
import type {
  // env.d.ts
  Env,
  
  // api.d.ts
  ApiResponse,
  ErrorDetail,
  ResponseMeta,
  ErrorResponse,
  HealthResponse,
  
  // config.d.ts
  DatabaseConfig,
  GoogleAccessToken,
  
  // session.d.ts
  Session,
  User,
  Role,
  Auth0Profile,
  
  // cache.d.ts
  CacheEntry,
  CacheResult,
  
  // sheets.d.ts
  SheetRow,
  ColumnDefinition,
  SheetMetadata,
  SheetPermissions,
  WhereClause,
  OrderByClause,
} from '../../src/types';

// Import database schema types
import type {
  Config,
  ConfigType,
  Cache,
} from '../../src/db/schema';

describe('Type Definitions', () => {
  describe('Environment Types', () => {
    it('should define Env interface correctly', () => {
      // Type-only test - if this compiles, the types are correctly defined
      const env: Partial<Env> = {
        LOG_LEVEL: 'info',
        CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
      };
      expect(env.LOG_LEVEL).toBe('info');
    });
  });

  describe('API Types', () => {
    it('should define ApiResponse interface correctly', () => {
      const response: ApiResponse<string> = {
        data: 'test',
        meta: {
          requestId: 'req-123',
          timestamp: new Date().toISOString(),
        },
      };
      expect(response.data).toBe('test');
    });

    it('should define ErrorResponse interface correctly', () => {
      const errorResponse: ErrorResponse = {
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
        },
        timestamp: new Date().toISOString(),
        path: '/test',
        requestId: 'req-123',
      };
      expect(errorResponse.error.code).toBe('TEST_ERROR');
    });
  });

  describe('Configuration Types', () => {
    it('should define Config interface correctly', () => {
      const config: Partial<Config> = {
        id: 1,
        key: 'test.key',
        value: 'test value',
        type: 'string' as ConfigType,
      };
      expect(config.key).toBe('test.key');
    });

    it('should define ConfigType correctly', () => {
      const types: ConfigType[] = ['string', 'number', 'boolean', 'json'];
      expect(types).toContain('string');
      expect(types).toContain('number');
      expect(types).toContain('boolean');
      expect(types).toContain('json');
    });
  });

  describe('Session Types', () => {
    it('should define Session interface correctly', () => {
      const session: Partial<Session> = {
        id: 'session-123',
        userId: 'user-123',
        auth0Sub: 'auth0|123',
        email: 'test@example.com',
      };
      expect(session.id).toBe('session-123');
    });
  });

  describe('Cache Types', () => {
    it('should define Cache interface correctly', () => {
      const cache: Partial<Cache> = {
        id: 1,
        cache_key: 'test:cache:key',
        data: '{"test": true}',
      };
      expect(cache.cache_key).toBe('test:cache:key');
    });

    it('should define CacheEntry interface correctly', () => {
      const cacheEntry: Partial<CacheEntry> = {
        id: 1,
        url: 'https://example.com/api/test',
        data: '{"test": true}',
        expiresAt: new Date(),
      };
      expect(cacheEntry.url).toBe('https://example.com/api/test');
    });
  });

  describe('Sheets Types', () => {
    it('should define SheetRow interface correctly', () => {
      const row: SheetRow = {
        id: 'row-123',
        publicRead: true,
        publicWrite: false,
        customField: 'custom value',
      };
      expect(row.id).toBe('row-123');
      expect(row.customField).toBe('custom value');
    });

    it('should define ColumnDefinition interface correctly', () => {
      const column: ColumnDefinition = {
        name: 'testColumn',
        type: 'string',
        required: true,
        unique: false,
      };
      expect(column.name).toBe('testColumn');
      expect(column.type).toBe('string');
    });
  });

  describe('Type Re-exports', () => {
    it('should re-export all types from index', () => {
      // This test verifies that all types can be imported from the main index
      // If any type is missing from the re-exports, this test will fail to compile
      const types = {
        Env: {} as Env,
        ApiResponse: {} as ApiResponse<any>,
        ErrorResponse: {} as ErrorResponse,
        Session: {} as Session,
        CacheEntry: {} as CacheEntry,
        SheetRow: {} as SheetRow,
      };
      
      expect(types).toBeDefined();
    });

    it('should import database schema types correctly', () => {
      // Test that database schema types are available
      const dbTypes = {
        Config: {} as Config,
        ConfigType: 'string' as ConfigType,
        Cache: {} as Cache,
      };
      
      expect(dbTypes).toBeDefined();
      expect(dbTypes.ConfigType).toBe('string');
    });
  });
});