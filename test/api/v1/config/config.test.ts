import { describe, it, expect } from 'vitest';
import app from '@/index';
import { env } from 'cloudflare:test';

describe('Config Management', () => {
  describe('GET /config', () => {
    it('should show login form when not authenticated', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config'),
        env
      );

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('設定管理');
      expect(html).toContain('設定画面にアクセスするにはパスワードが必要です');
    });
  });

  describe('POST /config/auth', () => {
    it('should redirect with error for empty password', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config/auth', {
          method: 'POST',
          body: new URLSearchParams({}),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }),
        env
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config?error=password_required');
    });
  });

  describe('GET /config/logout', () => {
    it('should redirect to config page', async () => {
      const response = await app.fetch(
        new Request('http://localhost/config/logout'),
        env
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/config');
    });
  });
});