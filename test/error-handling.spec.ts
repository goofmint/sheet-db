import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../src/index';
import { ConfigService } from '../src/services/config';
import { setupTestDatabase } from './utils/database-setup';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    path?: string;
    timestamp: string;
  };
}

describe('Error Handling Integration', () => {
  let db: DrizzleD1Database;

  beforeAll(async () => {
    // Get real D1 database from cloudflare:test environment
    db = drizzle(env.DB);
    
    // Setup test database with all tables
    await setupTestDatabase(db);
    
    // Initialize ConfigService with real database
    await ConfigService.initialize(db);
  });

  it('should test actual app existing routes work', async () => {
    const response = await app.fetch(
      new Request('http://localhost/api/v1/health'),
      env
    );
    
    expect(response.status).toBe(200);
  });

  it('should test actual app not found behavior', async () => {
    const response = await app.fetch(
      new Request('http://localhost/nonexistent'),
      env
    );
    const body = await response.json() as ErrorResponse;

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Route not found');
    expect(body.error.path).toBe('/nonexistent');
    expect(body.error.timestamp).toBeDefined();
  });

  it('should handle proper redirect from root', async () => {
    const response = await app.fetch(
      new Request('http://localhost/'),
      env
    );
    
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/setup');
  });

  it('should handle setup route', async () => {
    const response = await app.fetch(
      new Request('http://localhost/setup'),
      env
    );
    
    expect(response.status).toBe(200);
  });

  it('should handle playground route', async () => {
    const response = await app.fetch(
      new Request('http://localhost/playground'),
      env
    );
    
    expect(response.status).toBe(200);
  });
});