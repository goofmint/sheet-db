import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index';
import { ConfigService } from '../src/services/config';

describe('Main Application', () => {
  beforeEach(async () => {
    // Initialize ConfigService for testing without database
    ConfigService.initializeForTesting();
  });

  describe('GET /', () => {
    it('should redirect to /setup when setup is not completed', async () => {
      const response = await app.fetch(
        new Request('http://localhost/', { method: 'GET' }),
        { DB: {} as D1Database }
      );
      
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/setup');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.fetch(
        new Request('http://localhost/health', { method: 'GET' }),
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

  describe('GET /setup', () => {
    it('should return setup page', async () => {
      const response = await app.fetch(
        new Request('http://localhost/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('SheetDB Setup');
      expect(html).toContain('Welcome to SheetDB setup');
    });
  });

  describe('GET /playground', () => {
    it('should return playground page', async () => {
      const response = await app.fetch(
        new Request('http://localhost/playground', { method: 'GET' }),
        { DB: {} as D1Database }
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('SheetDB Playground');
      expect(html).toContain('API testing interface');
    });
  });
});