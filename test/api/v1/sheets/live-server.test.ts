import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { drizzle } from 'drizzle-orm/d1';
import app from '../../../../src/index';
import type { SheetsListResponse, SheetErrorResponse } from '../../../../src/api/v1/sheets/types';
import { setupConfigDatabase } from '../../../utils/database-setup';

// Type guards for response validation
function isSuccessResponse(data: unknown): data is SheetsListResponse {
  return typeof data === 'object' && 
         data !== null && 
         'success' in data && 
         data.success === true;
}

function isErrorResponse(data: unknown): data is SheetErrorResponse {
  return typeof data === 'object' && 
         data !== null && 
         'error' in data && 
         'message' in data &&
         typeof (data as SheetErrorResponse).error === 'string' &&
         typeof (data as SheetErrorResponse).message === 'string';
}

type ApiResponse = SheetsListResponse | SheetErrorResponse;

describe('Sheets API - Application Integration Tests', () => {
  beforeAll(async () => {
    // Setup database tables for testing
    const db = drizzle(env.DB);
    await setupConfigDatabase(db);
  });

  describe('GET /api/v1/sheets', () => {
    it('should return a response with correct structure', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(503); // Service Unavailable due to missing Google Sheet configuration
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json() as ApiResponse;
      
      // Should be an error response due to missing Google Sheet ID
      expect(data).toBeDefined();
      expect(isErrorResponse(data)).toBe(true);
      
      if (isErrorResponse(data)) {
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
        expect(typeof data.error).toBe('string');
        expect(typeof data.message).toBe('string');
      }
    }, 10000);

    it('should handle filter query parameter correctly', async () => {
      const request = new Request('http://localhost/api/v1/sheets?filter=test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(503);

      const data = await response.json() as ApiResponse;
      expect(data).toBeDefined();
      expect(isErrorResponse(data)).toBe(true);
    });

    it('should handle master key header', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'test-master-key'
        }
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(503);

      const data = await response.json() as ApiResponse;
      expect(data).toBeDefined();
      expect(isErrorResponse(data)).toBe(true);
    });

    it('should reject invalid HTTP methods', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(405); // Method Not Allowed
    });

    it('should handle CORS properly', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        }
      });

      const response = await app.fetch(request, env);

      // Should include CORS headers even in error responses
      expect(response.status).toBe(503);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(503);
      expect(responseTime).toBeLessThan(10000); // Less than 10 seconds
    }, 15000);

    it('should handle concurrent requests without issues', async () => {
      const requests = Array(3).fill(null).map(() => {
        const request = new Request('http://localhost/api/v1/sheets', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        return app.fetch(request, env);
      });

      const responses = await Promise.all(requests);
      
      // All requests should return consistent error status (503)
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

      // All responses should return 503 status
      responses.forEach(response => {
        expect(response.status).toBe(503);
      });

      const dataArray = await Promise.all(
        responses.map(r => r.json())
      ) as ApiResponse[];

      // All responses should have consistent error structure
      dataArray.forEach(data => {
        expect(data).toBeDefined();
        expect(isErrorResponse(data)).toBe(true);
        
        if (isErrorResponse(data)) {
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('message');
        }
      });
    });
  });

  describe('Application Integration', () => {
    it('should be accessible and responsive', async () => {
      const request = new Request('http://localhost/api/v1/health', {
        method: 'GET'
      });

      const healthResponse = await app.fetch(request, env);
      expect(healthResponse.ok).toBe(true);
      expect(healthResponse.status).toBe(200);

      const healthData = await healthResponse.json() as { status: string };
      expect(healthData).toHaveProperty('status', 'healthy');
    });
  });
});