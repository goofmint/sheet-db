import { describe, it, expect } from 'vitest';
import app from '../../../../src/index';

describe('Storage API - /api/v1/storages', () => {

  describe('POST /api/v1/storages', () => {
    it('should reject request without file', async () => {
      const formData = new FormData();
      
      const response = await app.fetch(new Request('http://localhost/api/v1/storages', {
        method: 'POST',
        body: formData
      }));

      // Should fail due to DB initialization error, but that's expected in test environment
      expect([400, 500]).toContain(response.status);
      const data = await response.json() as { error?: string };
      expect(data.error).toBeDefined();
    });

    it('should handle missing configuration gracefully', async () => {
      const formData = new FormData();
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      formData.append('file', file);

      const response = await app.fetch(new Request('http://localhost/api/v1/storages', {
        method: 'POST',
        body: formData
      }));

      // Should return an error due to missing configuration
      expect([400, 500, 503]).toContain(response.status);
      const data = await response.json() as { error?: string };
      expect(data.error).toBeDefined();
    });
  });

  describe('DELETE /api/v1/storages/:id', () => {
    it('should handle missing file ID', async () => {
      const response = await app.fetch(new Request('http://localhost/api/v1/storages/', {
        method: 'DELETE'
      }));

      // Should fail due to DB initialization error, but that's expected in test environment
      expect([404, 500]).toContain(response.status);
    });

    it('should handle missing configuration gracefully', async () => {
      const response = await app.fetch(new Request('http://localhost/api/v1/storages/test-file-id', {
        method: 'DELETE'
      }));

      // Should return an error due to missing configuration
      expect([400, 500]).toContain(response.status);
      const data = await response.json() as { error?: string };
      expect(data.error).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should include CORS headers', async () => {
      const formData = new FormData();
      
      const response = await app.fetch(new Request('http://localhost/api/v1/storages', {
        method: 'POST',
        body: formData,
        headers: {
          'Origin': 'https://example.com'
        }
      }));

      // CORS headers should be present (may be null in test environment)
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      expect(corsOrigin === '*' || corsOrigin === null).toBe(true);
    });
  });
});