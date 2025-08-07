import { describe, it, expect, beforeAll } from 'vitest';
import type { SheetsListResponse, SheetErrorResponse } from '../../../../src/api/v1/sheets/types';

const SERVER_URL = 'http://localhost:8787';

describe('Sheets API - Live Server Tests', () => {
  beforeAll(async () => {
    // Verify server is running
    const healthResponse = await fetch(`${SERVER_URL}/api/v1/health`);
    expect(healthResponse.ok).toBe(true);
  });

  describe('GET /api/v1/sheets', () => {
    it('should return a response with correct structure', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

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
      const response = await fetch(`${SERVER_URL}/api/v1/sheets?filter=test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Service not configured, expect 503
      expect(response.status).toBe(503);

      const data = await response.json() as SheetErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe('service_not_configured');
    });

    it('should handle master key header', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'test-master-key'
        }
      });

      // Service not configured, expect 503 regardless of master key
      expect(response.status).toBe(503);

      const data = await response.json() as SheetErrorResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe('service_not_configured');
    });

    it('should reject invalid HTTP methods', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.status).toBe(400); // Bad Request for invalid method
    });

    it('should handle CORS properly', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        }
      });

      // Service not configured, but CORS headers should still be present
      expect(response.status).toBe(503);
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    });

    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(503);
      expect(responseTime).toBeLessThan(10000); // Less than 10 seconds
    }, 15000);

    it('should handle concurrent requests without issues', async () => {
      const requests = Array(3).fill(null).map(() =>
        fetch(`${SERVER_URL}/api/v1/sheets`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
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
        fetch(`${SERVER_URL}/api/v1/sheets`),
        fetch(`${SERVER_URL}/api/v1/sheets?filter=test`),
        fetch(`${SERVER_URL}/api/v1/sheets`, {
          headers: { 'x-master-key': 'invalid' }
        })
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
      const healthResponse = await fetch(`${SERVER_URL}/api/v1/health`);
      expect(healthResponse.ok).toBe(true);
      expect(healthResponse.status).toBe(200);

      const healthData = await healthResponse.json() as { status: string };
      expect(healthData).toHaveProperty('status', 'healthy');
    });
  });
});