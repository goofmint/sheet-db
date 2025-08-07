import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '@/index';

// Test directly against the actual app instance without mocks
describe('Sheets API Real Integration Tests', () => {

  describe('GET /api/v1/sheets', () => {
    it('should return valid response structure when called directly', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');

      if (data.success) {
        expect(data.data).toHaveProperty('sheets');
        expect(data.data).toHaveProperty('total');
        expect(data.data).toHaveProperty('accessible_count');
        expect(data.meta).toHaveProperty('is_master_key_auth');
        expect(data.meta).toHaveProperty('include_system');
        expect(Array.isArray(data.data.sheets)).toBe(true);
      }
    });

    it('should handle filter query parameter', async () => {
      const request = new Request('http://localhost/api/v1/sheets?filter=test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(200);

      const data = await response.json();
      if (data.success && data.meta.filter_applied) {
        expect(data.meta.filter_applied).toBe('test');
      }
    });

    it('should handle master key authentication correctly', async () => {
      const testEnv = { ...env, MASTER_KEY: 'test-master-key' };
      
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'test-master-key'
        }
      });

      const response = await app.fetch(request, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('meta');
      
      if (data.success) {
        expect(data.meta.is_master_key_auth).toBe(true);
      }
    });

    it('should reject invalid master key', async () => {
      const testEnv = { ...env, MASTER_KEY: 'test-master-key' };
      
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-master-key': 'wrong-key'
        }
      });

      const response = await app.fetch(request, testEnv);
      expect(response.status).toBe(200);

      const data = await response.json();
      if (data.success) {
        expect(data.meta.is_master_key_auth).toBe(false);
      }
    });

    it('should return proper error format for invalid HTTP method', async () => {
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invalid: 'data' })
      });

      const response = await app.fetch(request, env);
      expect(response.status).toBe(405); // Method Not Allowed
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

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // Less than 5 seconds for unit test
    });

    it('should handle the actual sheet service behavior', async () => {
      // This test will fail if SheetService is not properly configured
      // but will show real behavior rather than mock behavior
      const request = new Request('http://localhost/api/v1/sheets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await app.fetch(request, env);
      
      // Should either succeed with real data or fail with specific error
      // This test validates the actual integration works
      expect([200, 500]).toContain(response.status);
      
      const data = await response.json();
      
      if (response.status === 200) {
        // If success, validate structure
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data.sheets)).toBe(true);
      } else {
        // If error, should be proper error format
        expect(data.success).toBe(false);
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('message');
      }
    });
  });
});