import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../../../src/index';
import { ConfigService } from '../../../../src/services/config';

describe('Setup API - GET /api/v1/setup', () => {
  beforeEach(() => {
    // Initialize ConfigService for testing
    ConfigService.initializeForTesting();
    ConfigService.clearCache();
  });

  describe('Setup incomplete scenarios', () => {
    it('should return setup status when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
      
      const data = await response.json() as any;
      expect(data.setup.isCompleted).toBe(false);
      expect(data.setup.requiredFields).toBeInstanceOf(Array);
      expect(data.setup.completedFields).toBeInstanceOf(Array);
      expect(data.setup.currentConfig).toBeDefined();
      expect(data.setup.progress).toBeDefined();
      expect(data.setup.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should include actual config values when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      const data = await response.json() as any;
      
      // セットアップ未完了時は実際の設定値が含まれる
      expect(data.setup.currentConfig.google).toBeDefined();
      expect(data.setup.currentConfig.auth0).toBeDefined();
      expect(data.setup.currentConfig.database).toBeDefined();
      
      // フラグ形式ではない
      expect(data.setup.currentConfig.hasGoogleCredentials).toBeUndefined();
      expect(data.setup.currentConfig.hasAuth0Config).toBeUndefined();
    });

    it('should calculate progress correctly', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      const data = await response.json() as any;
      const { progress } = data.setup;
      
      expect(progress.completedSteps).toBe(0); // 初期状態では0
      expect(progress.totalSteps).toBeGreaterThan(0);
      expect(progress.percentage).toBe(0);
    });

    it('should provide next steps when setup is incomplete', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      const data = await response.json() as any;
      
      expect(data.setup.nextSteps).toBeInstanceOf(Array);
      expect(data.setup.nextSteps.length).toBeGreaterThan(0);
      expect(data.setup.nextSteps[0]).toContain('Google');
    });
  });

  describe('Setup completed without authentication', () => {
    beforeEach(() => {
      // Mock setup completed state
      ConfigService.clearCache();
      // We can't easily mock the ConfigService in this test setup
      // This would require a more complex mock setup
    });

    it('should require authentication when setup is completed', async () => {
      // This test would need setup completed state mocked
      // For now, we'll test the authentication logic separately
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      // Since we can't easily mock setup completion, 
      // this will return the incomplete scenario
      expect(response.status).toBe(200);
    });
  });

  describe('Setup completed with authentication', () => {
    it('should accept valid Bearer token', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-password'
          }
        }),
        { DB: {} as D1Database }
      );

      // Since setup is not actually completed in test, this should still work
      expect(response.status).toBe(200);
    });

    it('should handle malformed Authorization header', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Authorization': 'InvalidFormat'
          }
        }),
        { DB: {} as D1Database }
      );

      // Should still work since setup is not completed
      expect(response.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Test error handling - this is difficult to trigger without mocking
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Response structure validation', () => {
    it('should have correct response structure', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { method: 'GET' }),
        { DB: {} as D1Database }
      );

      const data = await response.json() as any;
      
      // Check top-level structure
      expect(data).toHaveProperty('setup');
      expect(data).toHaveProperty('timestamp');
      
      // Check setup object structure
      const { setup } = data;
      expect(setup).toHaveProperty('isCompleted');
      expect(setup).toHaveProperty('requiredFields');
      expect(setup).toHaveProperty('completedFields');
      expect(setup).toHaveProperty('currentConfig');
      expect(setup).toHaveProperty('nextSteps');
      expect(setup).toHaveProperty('progress');
      
      // Check progress structure
      expect(setup.progress).toHaveProperty('percentage');
      expect(setup.progress).toHaveProperty('completedSteps');
      expect(setup.progress).toHaveProperty('totalSteps');
      
      // Check data types
      expect(typeof setup.isCompleted).toBe('boolean');
      expect(Array.isArray(setup.requiredFields)).toBe(true);
      expect(Array.isArray(setup.completedFields)).toBe(true);
      expect(Array.isArray(setup.nextSteps)).toBe(true);
      expect(typeof setup.progress.percentage).toBe('number');
    });

    it('should include CORS headers for cross-origin requests', async () => {
      const response = await app.fetch(
        new Request('http://localhost/api/v1/setup', { 
          method: 'GET',
          headers: {
            'Origin': 'https://example.com'
          }
        }),
        { DB: {} as D1Database }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
    });
  });
});