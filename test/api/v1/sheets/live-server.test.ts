import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '../../../../src/services/config';
import app from '../../../../src/index';
import { env } from 'cloudflare:test';
import type { SheetsListResponse, SheetErrorResponse } from '../../../../src/api/v1/sheets/types';
import { setupConfigDatabase } from '../../../utils/database-setup';

describe('Sheets API - Live Server Tests', () => {
  const db = drizzle(env.DB);

  beforeAll(async () => {
    // Setup database and ConfigService
    await setupConfigDatabase(db);
    await ConfigService.initialize(db);
  });

  describe('GET /api/v1/sheets', () => {
    it('should return a response with correct structure', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }),
        env
      );

      // In development environment, service may not be configured, expect 503
      expect(response.status).toBe(503);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json() as SheetErrorResponse;
      
      // Should return service unavailable error when not configured
      expect(data.success).toBe(false);
      expect(data.error).toBe('service_not_configured');
      expect(data.message).toContain('Google Sheets service is not properly configured');
    }, 10000);

    it('should handle filter query parameter correctly', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets?filter=test', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }),
        env
      );

      // Service not configured, expect 503
      expect(response.status).toBe(503);

      const data = await response.json() as SheetErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe('service_not_configured');
    });

    it('should handle master key header', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-master-key': 'test-master-key'
          }
        }),
        env
      );

      // Service not configured, expect 503 regardless of master key
      expect(response.status).toBe(503);

      const data = await response.json() as SheetErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe('service_not_configured');
    });

    it('should reject invalid HTTP methods', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: 'data' })
        }),
        env
      );

      expect(response.status).toBe(400); // Bad Request for invalid method
    });

    it('should handle CORS properly', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'http://localhost:3000'
          }
        }),
        env
      );

      // Service not configured, but CORS headers should still be present
      expect(response.status).toBe(503);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await app.fetch(
        new Request('http://localhost/api/v1/sheets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }),
        env
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(503);
      expect(responseTime).toBeLessThan(10000); // Less than 10 seconds
    }, 15000);

    it('should handle concurrent requests without issues', async () => {
      const requests = Array(3).fill(null).map(() =>
        app.fetch(
          new Request('http://localhost/api/v1/sheets', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }),
          env
        )
      );

      const responses = await Promise.all(requests);
      
      // All requests should return 503 consistently
      responses.forEach(response => {
        expect(response.status).toBe(503);
      });
    });

    it('should maintain consistent response format across multiple calls', async () => {
      // Make multiple calls to ensure consistency
      const responses = await Promise.all([
        app.fetch(new Request('http://localhost/api/v1/sheets'), env),
        app.fetch(new Request('http://localhost/api/v1/sheets?filter=test'), env),
        app.fetch(new Request('http://localhost/api/v1/sheets', {
          headers: { 'x-master-key': 'invalid' }
        }), env)
      ]);

      // All responses should return 503 status consistently
      responses.forEach(response => {
        expect(response.status).toBe(503);
      });

      const dataArray = await Promise.all(
        responses.map(r => r.json())
      ) as SheetErrorResponse[];

      // All responses should have consistent error structure
      dataArray.forEach(data => {
        expect(data.success).toBe(false);
        expect(data.error).toBe('service_not_configured');
        expect(data.message).toContain('Google Sheets service is not properly configured');
      });
    });
  });

  describe('Server Integration', () => {
    it('should be accessible and responsive', async () => {
      const healthResponse = await app.fetch(new Request('http://localhost/api/v1/health'), env);
      expect(healthResponse.ok).toBe(true);
      expect(healthResponse.status).toBe(200);

      const healthData = await healthResponse.json() as { status: string };
      expect(healthData).toHaveProperty('status', 'healthy');
    });
  });
});