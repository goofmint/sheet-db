import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../src/index';
import { ConfigService } from '../../src/services/config';
import { setupTestDatabase } from '../utils/database-setup';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

describe('API Router', () => {
  let db: DrizzleD1Database;

  beforeAll(async () => {
    // Get real D1 database from cloudflare:test environment
    db = drizzle(env.DB);
    
    // Setup test database with all tables
    await setupTestDatabase(db);
    
    // Initialize ConfigService with real database
    await ConfigService.initialize(db);
  });

  describe('GET /api', () => {
    it('should return API information', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as { name: string; version: string; endpoints: string[]; description: string; timestamp: string };
      expect(data.name).toBe('Sheet DB API');
      expect(data.version).toBe('1.0.0');
      expect(data.description).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/health', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as { status: string; service: string; version: string; timestamp: string };
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('sheetDB');
      expect(data.version).toBe('1.0.0');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('API 404 handling', () => {
    it('should return API-specific 404 for unknown endpoints', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/unknown', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(404);
      
      const data = await response.json() as { error: { code: string; message: string } };
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('not found');
    });

    it('should return API-specific 404 for unknown v1 endpoints', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/unknown', { method: 'GET' }),
        env
      );

      expect(response.status).toBe(404);
      
      const data = await response.json() as { error: { code: string; message: string } };
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('not found');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight requests', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/health', { 
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://example.com',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type',
          }
        }),
        env
      );

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should include CORS headers in actual requests', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/health', { 
          method: 'GET',
          headers: {
            'Origin': 'https://example.com',
          }
        }),
        env
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });

  describe('API Structure', () => {
    it('should maintain consistent response format for info endpoint', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api', { method: 'GET' }),
        env
      );

      const data = await response.json() as { name: string; version: string; endpoints: string[] };
      
      // Check required fields
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('timestamp');
    });
  });
});