import { describe, it, expect, beforeAll } from 'vitest';
import type { SheetsListResponse, SheetErrorResponse } from '../../../../src/api/v1/sheets/types';

const SERVER_URL = 'http://localhost:8787';

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

describe('Sheets API - Live Server Tests', () => {
  beforeAll(async () => {
    // Verify server is running
    try {
      const healthResponse = await fetch(`${SERVER_URL}/api/v1/health`);
      if (!healthResponse.ok) {
        throw new Error(`Server not healthy: ${healthResponse.status}`);
      }
    } catch (error) {
      throw new Error(`Server not accessible at ${SERVER_URL}. Please start with: npm run dev`);
    }
  });

  describe('GET /api/v1/sheets', () => {
    it('should return a response with correct structure', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json() as ApiResponse;
      
      // Should always have a response structure
      expect(data).toBeDefined();

      if (isSuccessResponse(data)) {
        // Success case - verify structure
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('meta');
        expect(data.data).toHaveProperty('sheets');
        expect(data.data).toHaveProperty('total');
        expect(data.data).toHaveProperty('accessible_count');
        expect(data.meta).toHaveProperty('is_master_key_auth');
        expect(data.meta).toHaveProperty('include_system');
        expect(Array.isArray(data.data.sheets)).toBe(true);
      } else if (isErrorResponse(data)) {
        // Error case - verify error structure
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
        expect(typeof data.error).toBe('string');
        expect(typeof data.message).toBe('string');
      } else {
        // Unknown response structure
        throw new Error('Response does not match expected API format');
      }
    }, 10000);

    it('should handle filter query parameter correctly', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets?filter=test`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json() as ApiResponse;
      expect(data).toBeDefined();

      // If successful, should include filter information
      if (isSuccessResponse(data)) {
        expect(data.meta.filter_applied).toBe('test');
      }
    });

    it('should handle master key header', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'test-master-key'
        }
      });

      expect(response.status).toBe(200);

      const data = await response.json() as ApiResponse;
      expect(data).toBeDefined();
      
      // Should process master key (even if invalid)
      if (isSuccessResponse(data)) {
        expect(typeof data.meta.is_master_key_auth).toBe('boolean');
      }
    });

    it('should reject invalid HTTP methods', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      });

      expect(response.status).toBe(400); // Bad Request (OpenAPI validation error)
    });

    it('should handle CORS properly', async () => {
      const response = await fetch(`${SERVER_URL}/api/v1/sheets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        }
      });

      // Should include CORS headers
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

      expect(response.status).toBe(200);
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
      
      // All requests should complete successfully (status 200)
      responses.forEach(response => {
        expect(response.status).toBe(200);
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

      const dataArray = await Promise.all(
        responses.map(r => r.json())
      ) as ApiResponse[];

      // All responses should have consistent structure
      dataArray.forEach(data => {
        expect(data).toBeDefined();
        
        if (isSuccessResponse(data)) {
          expect(data).toHaveProperty('data');
          expect(data).toHaveProperty('meta');
        } else if (isErrorResponse(data)) {
          expect(data).toHaveProperty('error');
          expect(data).toHaveProperty('message');
        } else {
          throw new Error('Response does not match expected API format');
        }
      });
    });
  });

  describe('Server Integration', () => {
    it('should be accessible and responsive', async () => {
      const healthResponse = await fetch(`${SERVER_URL}/api/v1/health`);
      expect(healthResponse.ok).toBe(true);

      const healthData = await healthResponse.json() as { status: string };
      expect(healthData).toHaveProperty('status', 'healthy');
    });
  });
});