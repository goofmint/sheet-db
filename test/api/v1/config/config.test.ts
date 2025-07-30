import { describe, it, expect } from 'vitest';
import { ConfigService } from '@/services/config';

describe('Config Management', () => {
  describe('ConfigService extensions', () => {
    it('should have getAll method', () => {
      expect(typeof ConfigService.getAll).toBe('function');
    });
    
    it('should have getType method', () => {
      expect(typeof ConfigService.getType).toBe('function');
    });
  });

  describe('Config route modules', () => {
    it('should export config get handler', async () => {
      const configGet = await import('@/api/v1/config/get');
      expect(configGet.default).toBeDefined();
    });

    it('should export config auth handler', async () => {
      const configAuth = await import('@/api/v1/config/auth');
      expect(configAuth.default).toBeDefined();
    });

    it('should export config logout handler', async () => {
      const configLogout = await import('@/api/v1/config/logout');
      expect(configLogout.default).toBeDefined();
    });
  });
});