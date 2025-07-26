import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../src/index';
import { ConfigService } from '../src/services/config';
import { setupTestDatabase } from './utils/database-setup';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

describe('Main Application', () => {
  let db: DrizzleD1Database;

  beforeAll(async () => {
    // Get real D1 database from cloudflare:test environment
    db = drizzle(env.DB);
    
    // Setup test database with all tables
    await setupTestDatabase(db);
    
    // Initialize ConfigService with real database
    await ConfigService.initialize(db);
  });

  describe('GET /', () => {
    it('should redirect to /setup when setup is not completed', async () => {
      const response = await app.fetch(
        new Request('http://localhost/', { method: 'GET' }),
        env
      );
      
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/setup');
    });
  });


  describe('GET /setup', () => {
    it('should return setup page', async () => {
      const response = await app.fetch(
        new Request('http://localhost/setup', { method: 'GET' }),
        env
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
        env
      );
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('SheetDB Playground');
      expect(html).toContain('API testing interface');
    });
  });

  describe('API Integration', () => {
    it('should serve API routes at /api prefix', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api', { method: 'GET' }),
        env
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.name).toBe('Sheet DB API');
    });

    it('should serve health check via API route', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/health', { method: 'GET' }),
        env
      );
      
      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('sheetDB');
    });

  });
});