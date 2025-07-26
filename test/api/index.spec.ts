import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../src/index';
import { ConfigService } from '../../src/services/config';

describe('API Router', () => {
  beforeEach(() => {
    // Initialize ConfigService for testing
    ConfigService.initializeForTesting();
  });

  describe('GET /api', () => {
    it('should return API information', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
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
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
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
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(404);
      
      const data = await response.json() as any;
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('not found');
    });

    it('should return API-specific 404 for unknown v1 endpoints', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/unknown', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(404);
      
      const data = await response.json() as any;
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
        { DB: {} as D1Database }
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
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });

  describe('API Structure', () => {
    it('should maintain consistent response format for info endpoint', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      const data = await response.json() as any;
      
      // Check required fields
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('description');
      expect(data).toHaveProperty('timestamp');
    });
  });
});