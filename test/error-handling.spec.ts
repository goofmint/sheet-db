import { describe, it, expect, beforeEach } from 'vitest';

// 実際のアプリケーションをインポート
import app from '../src/index';
import { ConfigService } from '../src/services/config';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    path?: string;
    timestamp: string;
  };
}

describe('Error Handling Integration', () => {
  beforeEach(async () => {
    // Initialize ConfigService for testing without database
    ConfigService.initializeForTesting();
  });

  it('should test actual app existing routes work', async () => {
    const response = await app.fetch(
      new Request('http://localhost/health'),
      { DB: {} as D1Database }
    );
    
    expect(response.status).toBe(200);
  });

  it('should test actual app not found behavior', async () => {
    const response = await app.fetch(
      new Request('http://localhost/nonexistent'),
      { DB: {} as D1Database }
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
      { DB: {} as D1Database }
    );
    
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/setup');
  });

  it('should handle setup route', async () => {
    const response = await app.fetch(
      new Request('http://localhost/setup'),
      { DB: {} as D1Database }
    );
    
    expect(response.status).toBe(200);
  });

  it('should handle playground route', async () => {
    const response = await app.fetch(
      new Request('http://localhost/playground'),
      { DB: {} as D1Database }
    );
    
    expect(response.status).toBe(200);
  });
});